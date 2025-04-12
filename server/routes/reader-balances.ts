import { Request, Response, Router } from 'express';
import { log } from '../server-only';
import { readerBalanceService } from '../services/reader-balance-service';

const router = Router();

// Middleware to verify the user is authenticated
const authenticate = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'You must be logged in' });
  }
  next();
};

// Middleware to verify the user is an admin
const adminOnly = (req: Request, res: Response, next: Function) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Middleware to verify the user is the reader or an admin
const readerOrAdminOnly = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'You must be logged in' });
  }
  
  const requestedReaderId = req.params.readerId;
  const userId = req.user.id?.toString();
  
  if (userId === requestedReaderId || req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ error: 'You can only access your own reader balance' });
  }
};

/**
 * Get reader balance for the current reader
 */
router.get('/my-balance', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'You must be logged in' });
    }
    
    if (req.user.role !== 'reader') {
      return res.status(403).json({ error: 'Only readers can access this endpoint' });
    }
    
    const balance = await readerBalanceService.getReaderBalance(req.user.id?.toString() || '');
    
    return res.status(200).json(balance);
  } catch (error: any) {
    log(`Error getting reader balance: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get reader balance', details: error.message });
  }
});

/**
 * Get reader balance by ID (reader or admin only)
 */
router.get('/:readerId', authenticate, readerOrAdminOnly, async (req: Request, res: Response) => {
  try {
    const { readerId } = req.params;
    
    const balance = await readerBalanceService.getReaderBalance(readerId);
    
    return res.status(200).json(balance);
  } catch (error: any) {
    log(`Error getting reader balance: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get reader balance', details: error.message });
  }
});

/**
 * Get all reader balances (admin only)
 */
router.get('/', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const balances = await readerBalanceService.getAllReaderBalances();
    
    return res.status(200).json(balances);
  } catch (error: any) {
    log(`Error getting all reader balances: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get all reader balances', details: error.message });
  }
});

/**
 * Get payout history for a reader (reader or admin only)
 */
router.get('/:readerId/payouts', authenticate, readerOrAdminOnly, async (req: Request, res: Response) => {
  try {
    const { readerId } = req.params;
    
    const payouts = await readerBalanceService.getReaderPayoutHistory(readerId);
    
    return res.status(200).json(payouts);
  } catch (error: any) {
    log(`Error getting reader payout history: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get reader payout history', details: error.message });
  }
});

/**
 * Process a payout for a reader (admin only)
 */
router.post('/:readerId/process-payout', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const { readerId } = req.params;
    
    const result = await readerBalanceService.processReaderPayout(readerId);
    
    return res.status(200).json(result);
  } catch (error: any) {
    log(`Error processing reader payout: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to process reader payout', details: error.message });
  }
});

/**
 * Trigger daily payouts for all eligible readers (admin only)
 */
router.post('/process-daily-payouts', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await readerBalanceService.scheduleDailyPayouts();
    
    return res.status(200).json(result);
  } catch (error: any) {
    log(`Error processing daily payouts: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to process daily payouts', details: error.message });
  }
});

export default router;