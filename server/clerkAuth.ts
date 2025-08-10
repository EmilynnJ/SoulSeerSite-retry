import { Express, Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { storage } from "./storage.js";
import { User, InsertUser } from "@shared/schema";
import { Clerk } from "@clerk/clerk-sdk-node";
import { CLERK_SECRET_KEY } from "./env.js";

// Extend Express Request for TS
declare global {
  namespace Express {
    interface Request {
      user?: User;
      isAuthenticated: () => boolean;
    }
  }
}

/**
 * Fetches Clerk user profile using the official Clerk SDK for production.
 * Throws if not found or on error.
 * Uses singleton Clerk client for efficiency.
 */
const clerkClient = Clerk({ secretKey: CLERK_SECRET_KEY });

async function fetchClerkUser(clerkUserId: string) {
  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    if (!clerkUser) throw new Error("Clerk user not found");

    // Use Clerk's username or generate one if unavailable
    let username = clerkUser.username;
    if (!username) {
      if (clerkUser.emailAddresses && clerkUser.emailAddresses.length > 0) {
        // use local part of email
        username = clerkUser.emailAddresses[0].emailAddress.split("@")[0];
      } else {
        username = `clerkuser_${clerkUserId}`;
      }
    }

    // Get primary email
    let email = "";
    if (clerkUser.primaryEmailAddressId) {
      const primary = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      );
      email = primary?.emailAddress || "";
    }
    if (!email && clerkUser.emailAddresses?.length) {
      email = clerkUser.emailAddresses[0].emailAddress;
    }
    if (!email) {
      email = `clerk_${clerkUserId}@noemail.com`;
    }

    // Get full name
    let fullName = clerkUser.firstName && clerkUser.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser.firstName || clerkUser.lastName || username;

    // Get profile image if available
    let profileImage = (clerkUser.imageUrl && typeof clerkUser.imageUrl === "string") ? clerkUser.imageUrl : "";

    return {
      email,
      username,
      fullName,
      profileImage
    };
  } catch (err) {
    // Log Clerk errors for security audits, but do not leak details to client
    // eslint-disable-next-line no-console
    console.error(`[CLERK ERROR] Failed to fetch Clerk user ${clerkUserId}:`, err);
    throw new Error("Failed to fetch Clerk user: " + (err as any)?.message);
  }
}

export function setupClerkAuth(app: Express) {
  app.use(clerkMiddleware());

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        req.isAuthenticated = () => false;
        req.user = undefined;
        return next();
      }

      // Try finding user in our DB
      let user = await storage.getUserByClerkId(userId);

      if (!user) {
        // No match - fetch from Clerk and create user in DB as 'client'
        const clerkData = await fetchClerkUser(userId);
        const email = clerkData.email;
        const username = clerkData.username;
        const fullName = clerkData.fullName;
        const profileImage = clerkData.profileImage;

        user = await storage.createUser({
          username,
          email,
          fullName,
          role: "client",
          bio: "",
          specialties: [],
          pricing: null,
          rating: null,
          verified: false,
          profileImage,
          clerkUserId: userId
        } as InsertUser);

        // Log new Clerk user auto-creation
        // eslint-disable-next-line no-console
        console.log(`[AUTH] Clerk user ${userId} auto-created as client: ${username} <${email}>`);
      }

      req.user = user;
      req.isAuthenticated = () => true;
    } catch (err) {
      req.isAuthenticated = () => false;
      req.user = undefined;
      // Log error for production monitoring, but don't leak to client
      // eslint-disable-next-line no-console
      console.error("Clerk authentication error:", err);
    }
    next();
  });
}