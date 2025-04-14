import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import * as mongodb from './mongodb';
import { log } from './server-only';
import bcrypt from 'bcrypt';

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  // Use bcrypt for MongoDB users
  if (process.env.MONGODB_URI) {
    try {
      const salt = await bcrypt.genSalt(10);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      log(`Error hashing password with bcrypt: ${error}`, 'auth');
      // Fall back to scrypt if bcrypt fails
    }
  }
  
  // Legacy password hashing for non-MongoDB users
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  // Check if it's a bcrypt hash (MongoDB users)
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    try {
      return await bcrypt.compare(supplied, stored);
    } catch (error) {
      log(`Error comparing passwords with bcrypt: ${error}`, 'auth');
      // Fall back to scrypt if bcrypt comparison fails
      return false;
    }
  }
  
  // Legacy password comparison for non-MongoDB users
  try {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    log(`Error comparing passwords with scrypt: ${error}`, 'auth');
    return false;
  }
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "soul-seer-secret-key-change-in-production";
  
  // Determine if we're in production based on the NODE_ENV
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`Setting up auth in ${isProduction ? 'production' : 'development'} mode`);
  
  // Always enable mobile-compatible session by default
  const isMobileCompatible = true;
  
  // For mobile app compatibility, we need special cookie settings
  // SameSite=None is required for cookies to work in WebViews, but this requires Secure=true
  // For non-production environments accessing through mobile apps, we need this combination
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true, // Changed to true to save all sessions
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // Longer expiration (30 days) for better UX
      secure: false, // We'll set this based on request in the middleware
      sameSite: "lax", // Default setting that works for most browsers
      domain: undefined, // No domain specification for now
      httpOnly: true // Ensure cookie is only accessible by the server
    }
  };
  
  // Log the session configuration for debugging
  console.log("Session settings:", {
    secure: sessionSettings.cookie?.secure,
    sameSite: sessionSettings.cookie?.sameSite,
    domain: sessionSettings.cookie?.domain,
    httpOnly: sessionSettings.cookie?.httpOnly
  });

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Check if input is email or username
        const isEmail = username.includes('@');
        let user;
        
        try {
          if (isEmail) {
            // Find user by email in MongoDB
            const mongoUser = await mongodb.User.findOne({ email: username.toLowerCase() }).lean();
            if (mongoUser) {
              // Convert MongoDB user to application user format
              user = {
                id: parseInt(mongoUser._id.toString().substring(0, 8), 16), // Generate numeric ID from MongoDB ObjectId
                username: mongoUser.username,
                email: mongoUser.email,
                password: mongoUser.password,
                fullName: mongoUser.fullName || '',
                profileImage: mongoUser.profileImage,
                bio: mongoUser.bio,
                role: mongoUser.role,
                rating: mongoUser.rating || 0,
                pricing: mongoUser.pricing || 0,
                specialties: mongoUser.specialties || [],
                verified: mongoUser.isVerified || false,
                isOnline: mongoUser.isOnline || false,
                createdAt: mongoUser.createdAt || new Date(),
                lastActive: mongoUser.lastActive || new Date(),
                reviewCount: mongoUser.reviewCount || 0,
                stripeCustomerId: mongoUser.stripeCustomerId || null
              };
              log(`Found user in MongoDB by email: ${mongoUser.email}`, 'auth');
            }
          } else {
            // Find user by username in MongoDB - case insensitive
            const mongoUser = await mongodb.User.findOne({ 
              username: { $regex: new RegExp('^' + username + '$', 'i') } 
            }).lean();
            
            if (mongoUser) {
              // Convert MongoDB user to application user format
              user = {
                id: parseInt(mongoUser._id.toString().substring(0, 8), 16), // Generate numeric ID from MongoDB ObjectId
                username: mongoUser.username,
                email: mongoUser.email,
                password: mongoUser.password,
                fullName: mongoUser.fullName || '',
                profileImage: mongoUser.profileImage,
                bio: mongoUser.bio,
                role: mongoUser.role,
                rating: mongoUser.rating || 0,
                pricing: mongoUser.pricing || 0,
                specialties: mongoUser.specialties || [],
                verified: mongoUser.isVerified || false,
                isOnline: mongoUser.isOnline || false,
                createdAt: mongoUser.createdAt || new Date(),
                lastActive: mongoUser.lastActive || new Date(),
                reviewCount: mongoUser.reviewCount || 0,
                stripeCustomerId: mongoUser.stripeCustomerId || null
              };
              log(`Found user in MongoDB by username: ${mongoUser.username}`, 'auth');
            }
          }
        } catch (mongoError) {
          log(`Error finding user in MongoDB: ${mongoError}`, 'auth');
          return done(mongoError);
        }
        
        if (!user) {
          log(`User not found: ${username}`, 'auth');
          return done(null, false, { message: "Invalid credentials" });
        }
        
        const passwordValid = await comparePasswords(password, user.password);
        if (!passwordValid) {
          log(`Invalid password for user: ${username}`, 'auth');
          return done(null, false, { message: "Invalid credentials" });
        }
        
        // Update last active time in MongoDB
        try {
          await mongodb.User.findOneAndUpdate(
            { username: user.username },
            { 
              $set: { 
                lastActive: new Date(),
                isOnline: true
              }
            }
          );
          log(`Updated user last active time in MongoDB: ${user.username}`, 'auth');
        } catch (updateError) {
          log(`Error updating user last active time: ${updateError}`, 'auth');
          // Continue even if update fails
        }
        
        log(`Authentication successful for user: ${user.username}`, 'auth');
        return done(null, user);
      } catch (error) {
        log(`Authentication error: ${error}`, 'auth');
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      log(`Deserializing user with ID ${id} from MongoDB`, 'auth');
      
      // Look for users with IDs that match the numeric ID pattern
      // This is a workaround for mapping MongoDB's ObjectIDs to our numeric IDs
      try {
        // Find all users and convert their ObjectIDs to see which one matches our ID
        const users = await mongodb.User.find({}).lean();
        
        // Find the user whose ID matches when converted to our format
        for (const mongoUser of users) {
          const numericId = parseInt(mongoUser._id.toString().substring(0, 8), 16);
          
          if (numericId === id) {
            // Convert MongoDB user to application user format
            const user = {
              id: numericId,
              username: mongoUser.username,
              email: mongoUser.email,
              password: mongoUser.password,
              fullName: mongoUser.fullName || '',
              profileImage: mongoUser.profileImage,
              bio: mongoUser.bio,
              role: mongoUser.role,
              rating: mongoUser.rating || 0,
              pricing: mongoUser.pricing || 0,
              specialties: mongoUser.specialties || [],
              verified: mongoUser.isVerified || false,
              isOnline: mongoUser.isOnline || false,
              createdAt: mongoUser.createdAt || new Date(),
              lastActive: mongoUser.lastActive || new Date(),
              reviewCount: mongoUser.reviewCount || 0,
              stripeCustomerId: mongoUser.stripeCustomerId || null
            };
            log(`User ${mongoUser.username} found in MongoDB, deserialized successfully`, 'auth');
            return done(null, user);
          }
        }
        
        // If we get here, no user with matching ID was found
        log(`User with ID ${id} not found in MongoDB`, 'auth');
        return done(null, null);
      } catch (mongoError) {
        log(`Error deserializing user from MongoDB: ${mongoError}`, 'auth');
        return done(mongoError);
      }
    } catch (error) {
      log(`Error deserializing user: ${error}`, 'auth');
      return done(null, null); // Return null instead of error to prevent breaking the application
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, email, password, fullName, role } = req.body;
      
      // Force role to be client regardless of what was sent
      // This ensures only clients can self-register
      if (role !== "client") {
        return res.status(403).json({ 
          message: "Only client accounts can be registered. Please contact administration for reader accounts." 
        });
      }
      
      try {
        // Check if username exists in MongoDB
        const existingUsername = await mongodb.User.findOne({ 
          username: { $regex: new RegExp('^' + username + '$', 'i') } 
        });
        
        if (existingUsername) {
          return res.status(400).json({ message: "Username already exists" });
        }
        
        // Check if email exists in MongoDB
        const existingEmail = await mongodb.User.findOne({ 
          email: { $regex: new RegExp('^' + email + '$', 'i') } 
        });
        
        if (existingEmail) {
          return res.status(400).json({ message: "Email already exists" });
        }
        
        // Create user with hashed password using MongoDB directly
        const hashedPassword = await hashPassword(password);
        
        // Create new user in MongoDB
        const newMongoUser = new mongodb.User({
          username,
          email,
          password: hashedPassword,
          fullName,
          role: "client", // Force role to client
          bio: "",
          specialties: [],
          pricing: 0,
          pricingChat: 0,
          pricingVoice: 0,
          pricingVideo: 0,
          rating: 0,
          isVerified: false,
          profileImage: "",
          isOnline: false,
          isAvailable: false,
          lastSeen: new Date(),
          stripeCustomerId: null,
          stripeConnectId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          timezone: "UTC",
          notificationPreferences: {},
          emailVerified: false,
          accountBalance: 0,
          lastActive: new Date(),
          reviewCount: 0
        });
        
        const savedUser = await newMongoUser.save();
        
        // Create app user format for login
        const user = {
          id: parseInt(savedUser._id.toString().substring(0, 8), 16),
          username: savedUser.username,
          email: savedUser.email,
          password: savedUser.password,
          fullName: savedUser.fullName || '',
          profileImage: savedUser.profileImage,
          bio: savedUser.bio,
          role: savedUser.role,
          rating: savedUser.rating || 0,
          pricing: savedUser.pricing || 0,
          specialties: savedUser.specialties || [],
          verified: savedUser.isVerified || false,
          isOnline: savedUser.isOnline || false,
          createdAt: savedUser.createdAt || new Date(),
          lastActive: savedUser.lastActive || new Date(),
          reviewCount: savedUser.reviewCount || 0,
          stripeCustomerId: savedUser.stripeCustomerId || null
        };
        
        // Create a new object without the password
        const { password: pwd, ...userResponse } = user;
        
        // Log in the user
        req.login(user, (err: any) => {
          if (err) return next(err);
          res.status(201).json({
            ...userResponse,
            isAuthenticated: true,
            authenticatedAt: new Date().toISOString()
          });
        });
        
      } catch (mongoError) {
        log(`Error in register with MongoDB: ${mongoError}`, 'auth');
        return next(mongoError);
      }
    } catch (error) {
      log(`Error in register: ${error}`, 'auth');
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    // Clear any existing session
    req.logout((err) => {
      if (err) return next(err);
      
      passport.authenticate("local", (err: any, user: Express.User | false, info: { message?: string } | undefined) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ message: info?.message || "Invalid username or password" });
      
      // Check if the request is from a mobile client via User-Agent
      const userAgent = req.headers['user-agent'] || '';
      const isMobileClient = /android|iphone|ipad|ipod|webos|mobile/i.test(userAgent);
      
      console.log(`Login request from ${isMobileClient ? 'mobile' : 'desktop'} client: ${userAgent}`);

      // Special cookie handling for mobile clients
      if (isMobileClient && req.session && req.session.cookie) {
        console.log("Setting mobile-friendly cookie parameters");
        
        // Check if the connection is HTTPS
        const origin = req.headers.origin || '';
        const isHttps = origin.startsWith('https:') || req.secure;
        
        if (isHttps) {
          // If HTTPS, set SameSite=None with Secure=true for cross-site functionality
          // This works best with WebViews and cross-origin requests
          req.session.cookie.sameSite = "none";
          req.session.cookie.secure = true; // Required for SameSite=None
        } else {
          // For HTTP development environment, use a more permissive approach
          // This won't be as secure, but works better for development testing
          req.session.cookie.sameSite = "lax";
          req.session.cookie.secure = false;
        }
        
        // Extended session timeout for mobile users
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days for mobile
        
        // Log the cookie settings applied
        console.log(`Cookie settings for mobile: sameSite=${req.session.cookie.sameSite}, secure=${req.session.cookie.secure}, maxAge=${req.session.cookie.maxAge}, isHttps=${isHttps}`);
      }
      
      req.login(user, (err: any) => {
        if (err) return next(err);
        
        // Create a new object from user data without the password
        const { password: pwd, ...userResponse } = user;
        
        // Add cache headers to prevent client-side caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        
        // Set additional connection reuse headers for mobile apps
        if (isMobileClient) {
          res.setHeader('Connection', 'keep-alive');
          
          // Set a session ID in response header that the mobile app can save and reuse
          // Mobile app should include this in subsequent requests in Authorization header
          const sessionID = req.sessionID;
          res.setHeader('X-Session-ID', sessionID);
          
          console.log(`Set X-Session-ID header: ${sessionID}`);
        }
        
        // Return user data
        res.status(200).json({
          ...userResponse,
          // Include authentication status in the response
          isAuthenticated: true,
          // Include a timestamp to help debug sessions
          authenticatedAt: new Date().toISOString(),
          // Include session info for mobile devices
          ...(isMobileClient && { 
            sessionID: req.sessionID,
            isMobileSession: true 
          })
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err: any) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    // Check for standard session authentication
    if (req.isAuthenticated()) {
      // Create a new object from user data without the password
      const { password: pwd, ...userResponse } = req.user as SelectUser;
      return res.json(userResponse);
    }
    
    // Check for mobile session authentication via header
    const sessionId = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (sessionId) {
      log(`Attempting to restore session from X-Session-ID: ${sessionId}`, 'auth');
      
      // Try to restore the session from store
      storage.sessionStore.get(sessionId as string, async (err, session) => {
        if (err || !session || !session.passport || !session.passport.user) {
          log('Invalid or expired session ID', 'auth');
          return res.sendStatus(401);
        }
        
        try {
          // Get the user from the session's passport data
          const userId = session.passport.user;
          
          // Try to find user in MongoDB first
          try {
            log(`Finding user in MongoDB with ID: ${userId}`, 'auth');
            const users = await mongodb.User.find({}).lean();
            
            // Look for the user with matching ID after conversion
            for (const mongoUser of users) {
              const numericId = parseInt(mongoUser._id.toString().substring(0, 8), 16);
              
              if (numericId === userId) {
                // Convert MongoDB user to application user format
                const user = {
                  id: numericId,
                  username: mongoUser.username,
                  email: mongoUser.email,
                  password: mongoUser.password,
                  fullName: mongoUser.fullName || '',
                  profileImage: mongoUser.profileImage,
                  bio: mongoUser.bio,
                  role: mongoUser.role,
                  rating: mongoUser.rating || 0,
                  pricing: mongoUser.pricing || 0,
                  specialties: mongoUser.specialties || [],
                  verified: mongoUser.isVerified || false,
                  isOnline: mongoUser.isOnline || false,
                  createdAt: mongoUser.createdAt || new Date(),
                  lastActive: mongoUser.lastActive || new Date(),
                  reviewCount: mongoUser.reviewCount || 0,
                  stripeCustomerId: mongoUser.stripeCustomerId || null
                };
                
                // Restore the session
                req.session.passport = session.passport;
                req.session.save();
                
                // Create a new object from user data without the password
                const { password: pwd, ...userResponse } = user;
                log(`Successfully restored session for user ${user.username} from MongoDB`, 'auth');
                
                // Update the user's last active time
                await mongodb.User.findOneAndUpdate(
                  { _id: mongoUser._id },
                  { $set: { lastActive: new Date(), isOnline: true } }
                );
                
                return res.json({
                  ...userResponse,
                  sessionRestored: true,
                  source: 'mongodb'
                });
              }
            }
          } catch (mongoError) {
            log(`Error finding user in MongoDB: ${mongoError}`, 'auth');
            // Fall back to traditional storage
          }
          
          // Fall back to traditional storage
          const user = await storage.getUser(userId);
          
          if (!user) {
            log('User not found from session ID', 'auth');
            return res.sendStatus(401);
          }
          
          // Restore the session
          req.session.passport = session.passport;
          req.session.save();
          
          // Create a new object from user data without the password
          const { password: pwd, ...userResponse } = user;
          log(`Successfully restored session for user ${user.username} from traditional storage`, 'auth');
          
          return res.json({
            ...userResponse,
            sessionRestored: true,
            source: 'traditional'
          });
        } catch (error) {
          log(`Error restoring session: ${error}`, 'auth');
          return res.sendStatus(401);
        }
      });
      
      return; // Important to prevent the function from continuing
    }
    
    // No valid authentication found
    return res.sendStatus(401);
  });
}
