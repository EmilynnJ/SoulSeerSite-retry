import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, users, type NewUser } from "@shared/schema";
import { eq, and, or, ilike } from "drizzle-orm";
import { log } from './server-only';
import bcrypt from 'bcrypt';
import { db } from "./db"; // PostgreSQL db reference

declare global {
  namespace Express {
    // Update User interface to match PostgreSQL schema
    interface User {
      id: number;
      username: string;
      email: string;
      password: string;
      fullName: string | null;
      role: string;
      profileImage: string | null;
      bio: string | null;
      isVerified: boolean | null;
      isOnline: boolean | null;
      isAvailable: boolean | null;
      stripeCustomerId: string | null;
      stripeConnectId: string | null;
      specialties: string[] | null;
      yearsOfExperience: number | null;
      rating: number | null;
      reviewCount: number | null;
      pricingVideo: number | null;
      pricingVoice: number | null;
      pricingChat: number | null;
      minimumSessionLength: number | null;
      completedReadings: number | null;
      totalReadingMinutes: number | null;
      accountBalance: number | null;
      lastActive: Date | null;
      createdAt: Date | null;
      updatedAt: Date | null;
    }
  }
}

const scryptAsync = promisify(scrypt);

// Standard password hashing using bcrypt
async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    log(`Error hashing password with bcrypt: ${error}`, 'auth');
    
    // Fall back to scrypt if bcrypt fails
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }
}

// Password comparison supporting both bcrypt and legacy scrypt hashes
async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  // Check if it's a bcrypt hash
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    try {
      return await bcrypt.compare(supplied, stored);
    } catch (error) {
      log(`Error comparing passwords with bcrypt: ${error}`, 'auth');
      return false;
    }
  }
  
  // Legacy password comparison using scrypt
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

export function setupAuth(app: Express): void {
  const sessionSecret = process.env.SESSION_SECRET || "soul-seer-secret-key-change-in-production";
  
  // Determine if we're in production based on the NODE_ENV
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`Setting up auth in ${isProduction ? 'production' : 'development'} mode`);
  
  // For mobile app compatibility, we need special cookie settings
  // SameSite=None is required for cookies to work in WebViews, but this requires Secure=true
  // For non-production environments accessing through mobile apps, we need this combination
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true
    },
    rolling: true // Refresh session with each request
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

  // Configure LocalStrategy to authenticate users
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Check if input is email or username
        const isEmail = username.includes('@');
        let user: SelectUser | undefined;
        
        try {
          if (isEmail) {
            // Find user by email in PostgreSQL
            const results = await db.select().from(users).where(eq(users.email, username.toLowerCase())).limit(1);
            user = results[0];
            if (user) {
              log(`Found user in PostgreSQL by email: ${user.email}`, 'auth');
            }
          } else {
            // Find user by username in PostgreSQL (case insensitive)
            const results = await db.select().from(users).where(ilike(users.username, username)).limit(1);
            user = results[0];
            if (user) {
              log(`Found user in PostgreSQL by username: ${user.username}`, 'auth');
            }
          }
        } catch (dbError) {
          log(`Error finding user in PostgreSQL: ${dbError}`, 'auth');
          return done(dbError);
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
        
        // Update last active time in PostgreSQL
        try {
          await db.update(users)
            .set({ 
              lastActive: new Date(),
              isOnline: true 
            })
            .where(eq(users.id, user.id));
            
          log(`Updated user last active time in PostgreSQL: ${user.username}`, 'auth');
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

  // Serialize and deserialize user for session management
  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      log(`Deserializing user with ID ${id} from PostgreSQL`, 'auth');
      
      try {
        // Find user by ID in PostgreSQL
        const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
        const user = results[0];
        
        if (user) {
          log(`User ${user.username} found in PostgreSQL, deserialized successfully`, 'auth');
          return done(null, user);
        }
        
        // If we get here, no user with matching ID was found
        log(`User with ID ${id} not found in PostgreSQL`, 'auth');
        return done(null, null);
      } catch (dbError) {
        log(`Error deserializing user from PostgreSQL: ${dbError}`, 'auth');
        return done(dbError);
      }
    } catch (error) {
      log(`Error deserializing user: ${error}`, 'auth');
      return done(null, null); // Return null instead of error to prevent breaking the application
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req: Request, res: Response, next: NextFunction) => {
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
        // Check if username exists in PostgreSQL
        const existingUsernameResults = await db.select().from(users)
          .where(ilike(users.username, username))
          .limit(1);
        
        if (existingUsernameResults.length > 0) {
          return res.status(400).json({ message: "Username already exists" });
        }
        
        // Check if email exists in PostgreSQL
        const existingEmailResults = await db.select().from(users)
          .where(ilike(users.email, email))
          .limit(1);
        
        if (existingEmailResults.length > 0) {
          return res.status(400).json({ message: "Email already exists" });
        }
        
        // Create user with hashed password
        const hashedPassword = await hashPassword(password);
        
        // Create new user in PostgreSQL
        const newUser: NewUser = {
          username,
          email,
          password: hashedPassword,
          fullName,
          role: "client", // Force role to client
          bio: "",
          specialties: [],
          isVerified: false,
          profileImage: "",
          isOnline: false,
          isAvailable: false,
          stripeCustomerId: null,
          stripeConnectId: null,
          lastActive: new Date()
          // createdAt and updatedAt are automatically set by the database
        };
        
        const [insertedUser] = await db.insert(users).values(newUser).returning();
        
        // Create a new object without the password
        const { password: pwd, ...userResponse } = insertedUser;
        
        // Log in the user
        req.login(insertedUser, (err: any) => {
          if (err) return next(err);
          res.status(201).json({
            ...userResponse,
            isAuthenticated: true,
            authenticatedAt: new Date().toISOString()
          });
        });
        
      } catch (dbError) {
        log(`Error in register with PostgreSQL: ${dbError}`, 'auth');
        return next(dbError);
      }
    } catch (error) {
      log(`Error in register: ${error}`, 'auth');
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
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
  });

  // Logout endpoint
  app.post("/api/logout", (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Current user endpoint
  app.get("/api/user", (req: Request, res: Response) => {
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
      storage.sessionStore.get(sessionId as string, async (err: any, session: any) => {
        if (err || !session || !session.passport || !session.passport.user) {
          log('Invalid or expired session ID', 'auth');
          return res.sendStatus(401);
        }
        
        try {
          // Get the user from the session's passport data
          const userId = session.passport.user;
          
          try {
            log(`Finding user in PostgreSQL with ID: ${userId}`, 'auth');
            
            // Find the user in PostgreSQL
            const results = await db.select().from(users).where(eq(users.id, userId)).limit(1);
            const user = results[0];
            
            if (user) {
              // Restore the session
              req.session.passport = session.passport;
              req.session.save();
              
              // Create a new object from user data without the password
              const { password: pwd, ...userResponse } = user;
              log(`Successfully restored session for user ${user.username} from PostgreSQL`, 'auth');
              
              // Update the user's last active time
              await db.update(users)
                .set({ lastActive: new Date(), isOnline: true })
                .where(eq(users.id, userId));
              
              return res.json({
                ...userResponse,
                sessionRestored: true
              });
            }
          } catch (dbError) {
            log(`Error finding user in PostgreSQL: ${dbError}`, 'auth');
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