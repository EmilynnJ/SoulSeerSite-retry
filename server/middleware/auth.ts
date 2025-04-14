import { Request, Response, NextFunction } from 'express';

/**
 * Authentication middleware
 * Checks if user is authenticated and adds user data to request object
 */
export function authGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

/**
 * Admin role middleware
 * Checks if authenticated user has admin role
 */
export function adminGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden - Admin access required' });
  }
  next();
}

/**
 * Reader role middleware
 * Checks if authenticated user has reader role
 */
export function readerGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'reader') {
    return res.status(403).json({ message: 'Forbidden - Reader access required' });
  }
  next();
}

/**
 * Client role middleware
 * Checks if authenticated user has client role
 */
export function clientGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'client') {
    return res.status(403).json({ message: 'Forbidden - Client access required' });
  }
  next();
}

/**
 * Resource owner middleware
 * Checks if authenticated user owns the requested resource
 * @param getResourceUserId Function that extracts user ID from the resource
 */
export function ownerGuard(getResourceUserId: (req: Request) => Promise<number | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
      const resourceUserId = await getResourceUserId(req);
      
      if (resourceUserId === null) {
        return res.status(404).json({ message: 'Resource not found' });
      }

      if (req.user.role === 'admin') {
        // Admins can access any resource
        return next();
      }

      if (req.user.id !== resourceUserId) {
        return res.status(403).json({ message: 'Forbidden - You do not own this resource' });
      }

      next();
    } catch (error) {
      console.error('Error in ownerGuard middleware:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
}