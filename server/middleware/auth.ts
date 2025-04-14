import { Request, Response, NextFunction } from 'express';

// Authentication middleware
export const authGuard = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// Admin authentication middleware
export const adminGuard = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: "Unauthorized. Admin access required." });
  }
  
  next();
};

// Reader authentication middleware
export const readerGuard = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  if (req.user.role !== 'reader') {
    return res.status(403).json({ message: "Unauthorized. Reader access required." });
  }
  
  next();
};