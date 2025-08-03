import { Express, Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { storage } from "./storage.js";
import { User, InsertUser } from "@shared/schema";

// Extend Express Request for TS
declare global {
  namespace Express {
    interface Request {
      user?: User;
      isAuthenticated: () => boolean;
    }
  }
}

// Minimal Clerk user info fetch fallback
async function fetchClerkUser(clerkUserId: string): Promise<{ email?: string; username?: string; fullName?: string }> {
  // Ideally, use Clerk SDK; fallback to generic structure for now.
  // (In real use, import Clerk SDK and call clerkClient.users.getUser(clerkUserId))
  return {
    email: `clerk_${clerkUserId}@noemail.com`,
    username: `clerkuser_${clerkUserId}`,
    fullName: `Clerk User`
  };
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
        const email = clerkData.email || `clerk_${userId}@noemail.com`;
        const username = clerkData.username || `clerkuser_${userId}`;
        const fullName = clerkData.fullName || username;

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
          profileImage: "",
          clerkUserId: userId
        } as InsertUser);
      }

      req.user = user;
      req.isAuthenticated = () => true;
    } catch (err) {
      req.isAuthenticated = () => false;
      req.user = undefined;
      // Optionally log error
    }
    next();
  });
}