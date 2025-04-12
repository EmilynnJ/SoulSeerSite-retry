import { Request, Response, Router } from 'express';
import * as mongodb from '../mongodb';
import { log } from '../server-only';

// Session types handled by this router
const SESSION_TYPES = ['video', 'audio', 'chat'];

const router = Router();

// Middleware to verify the user is authenticated
const authenticate = (req: Request, res: Response, next: Function) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'You must be logged in' });
  }
  next();
};

/**
 * Start a pay-per-minute session
 * 
 * This endpoint handles initializing a pay-per-minute session for readings
 */
router.post('/start', authenticate, async (req: Request, res: Response) => {
  try {
    const { readerId, duration = 5, type = 'chat' } = req.body;
    
    if (!req.user || !readerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!SESSION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid session type' });
    }

    const clientId = req.user.id;
    
    // Get client and reader from database
    const reader = await mongodb.User.findById(readerId);
    if (!reader) {
      return res.status(404).json({ error: 'Reader not found' });
    }
    
    // Determine rate based on session type
    let rate = 0;
    switch (type) {
      case 'video':
        rate = reader.pricingVideo || reader.pricing || 0;
        break;
      case 'audio':
        rate = reader.pricingVoice || reader.pricing || 0;
        break;
      case 'chat':
        rate = reader.pricingChat || reader.pricing || 0;
        break;
    }
    
    if (rate <= 0) {
      return res.status(400).json({ error: 'Reader does not have a valid rate for this session type' });
    }
    
    // Calculate total amount needed
    const amount = rate * duration;
    
    // Check client balance to ensure they have enough funds
    const clientBalance = await mongodb.ClientBalance.findOne({ clientId: req.user.id });
    
    if (!clientBalance) {
      return res.status(400).json({ error: 'Client balance not found' });
    }
    
    if (clientBalance.balance < amount) {
      return res.status(400).json({ 
        error: 'Insufficient funds', 
        balance: clientBalance.balance,
        required: amount,
        needsTopup: true
      });
    }
    
    // Create a reading record
    const reading = await mongodb.Reading.create({
      clientId: req.user.id,
      readerId: reader._id,
      type,
      status: 'in_progress',
      scheduledAt: new Date(),
      duration: 0,
      totalAmount: 0
    });
    
    // Generate a unique room ID
    const roomId = `session_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create session record
    const session = await mongodb.Session.create({
      readingId: reading._id,
      clientId: req.user.id,
      readerId: reader._id,
      type,
      status: 'initialized',
      roomId,
      minuteRate: rate,
      initialDuration: duration,
      authorizedAmount: amount,
      remainingMinutes: duration,
      provider: type === 'video' ? 'zego' : 'internal',
      connectionDetails: {
        roomId,
        participantIds: [req.user.id, reader._id.toString()]
      }
    });
    
    // Lock funds in client balance
    clientBalance.balance -= amount;
    clientBalance.lockedAmount += amount;
    await clientBalance.save();
    
    // Return session details
    return res.status(201).json({
      success: true,
      session: {
        id: session._id,
        roomId: session.roomId,
        readerId: reader._id,
        clientId: req.user.id,
        type: session.type,
        rate: session.minuteRate,
        initialDuration: session.initialDuration,
        authorizedAmount: session.authorizedAmount,
        provider: session.provider
      }
    });
    
  } catch (error: any) {
    log(`Error starting pay-per-minute session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to start session', details: error.message });
  }
});

/**
 * Update a pay-per-minute session for billing
 * 
 * This endpoint handles updating the billing for an active session
 */
router.post('/billing', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    
    // Get session from database
    const session = await mongodb.Session.findOne({ roomId: sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if session is active
    if (session.status !== 'active' && session.status !== 'initialized') {
      return res.status(400).json({ error: `Session is not active (${session.status})` });
    }
    
    // Get client from request
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // If session was just initialized, mark it as active
    if (session.status === 'initialized') {
      session.status = 'active';
      session.startTime = new Date();
      await session.save();
      
      return res.status(200).json({ 
        success: true, 
        session,
        message: 'Session activated'
      });
    }
    
    // Calculate elapsed time
    const now = new Date();
    const startTime = session.startTime || session.createdAt;
    const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    
    // Check if we have a new full minute to bill
    const lastBilledMinute = session.lastBilledMinute || 0;
    const minutesToBill = elapsedMinutes - lastBilledMinute;
    
    // Only the client gets billed
    const isReader = session.readerId.toString() === req.user.id.toString();
    
    // If it's the reader or no new minutes, just return the session
    if (isReader || minutesToBill <= 0) {
      return res.status(200).json({ 
        success: true, 
        session,
        elapsedSeconds,
        elapsedMinutes,
        lastBilledMinute,
        message: 'Session updated (no billing)'
      });
    }
    
    // Check if we have enough authorized funds
    if (session.billedMinutes + minutesToBill > session.initialDuration) {
      // Need more funds
      return res.status(200).json({ 
        success: true, 
        session,
        needsMoreFunds: true,
        message: 'Session needs additional funds to continue'
      });
    }
    
    // Calculate amount to bill
    const amountToBill = minutesToBill * session.minuteRate;
    
    // Update session with billing information
    session.billedMinutes += minutesToBill;
    session.billedAmount += amountToBill;
    session.lastBillingTime = now;
    session.lastBilledMinute = elapsedMinutes;
    
    // Check if we're approaching the limit of authorized minutes
    const remainingMinutes = session.initialDuration - session.billedMinutes;
    session.remainingMinutes = remainingMinutes;
    
    const needsMoreFunds = remainingMinutes <= 2; // Alert when less than 2 minutes remain
    
    await session.save();
    
    // Update the reading with current duration and amount
    await mongodb.Reading.findByIdAndUpdate(session.readingId, {
      duration: session.billedMinutes,
      totalAmount: session.billedAmount
    });
    
    return res.status(200).json({ 
      success: true, 
      session,
      needsMoreFunds,
      minutesBilled: minutesToBill,
      remainingMinutes: session.remainingMinutes,
      message: 'Session updated successfully'
    });
    
  } catch (error: any) {
    log(`Error updating pay-per-minute session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to update session', details: error.message });
  }
});

/**
 * End a pay-per-minute session
 * 
 * This endpoint handles ending an active session and finalizing billing
 */
router.post('/end', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    
    // Get session from database
    const session = await mongodb.Session.findOne({ roomId: sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if session is already ended
    if (session.status === 'completed' || session.status === 'cancelled') {
      return res.status(400).json({ error: 'Session already ended' });
    }
    
    // Get user from request
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Update session status
    session.status = 'completed';
    session.endTime = new Date();
    session.endedBy = req.user.id;
    
    // Calculate final billing if session was active
    if (session.status === 'active') {
      // Calculate remaining locked amount to refund
      const refundAmount = session.authorizedAmount - session.billedAmount;
      
      if (refundAmount > 0) {
        // Refund unused locked amount to client's balance
        await mongodb.ClientBalance.findOneAndUpdate(
          { clientId: session.clientId },
          { 
            $inc: { 
              balance: refundAmount,
              lockedAmount: -refundAmount
            }
          }
        );
      }
      
      // Create payment record
      if (session.billedAmount > 0) {
        // Calculate platform fee (30%)
        const platformFee = Math.floor(session.billedAmount * 0.3);
        const readerShare = session.billedAmount - platformFee;
        
        await mongodb.Payment.create({
          readingId: session.readingId,
          userId: session.clientId,
          readerId: session.readerId,
          amount: session.billedAmount,
          status: 'completed',
          type: 'reading',
          readerShare,
          platformFee,
          metadata: {
            sessionType: session.type,
            duration: session.billedMinutes,
            minuteRate: session.minuteRate
          }
        });
        
        // Update reader balance
        const readerBalance = await mongodb.ReaderBalance.findOne({ readerId: session.readerId });
        if (readerBalance) {
          readerBalance.balance += readerShare;
          readerBalance.lifetimeEarnings += readerShare;
          await readerBalance.save();
        } else {
          // Create new reader balance if it doesn't exist
          await mongodb.ReaderBalance.create({
            readerId: session.readerId,
            balance: readerShare,
            lifetimeEarnings: readerShare,
            lastPayout: null
          });
        }
      }
    }
    
    // Save session changes
    await session.save();
    
    // Update reading record
    await mongodb.Reading.findByIdAndUpdate(session.readingId, {
      status: 'completed',
      duration: session.billedMinutes,
      totalAmount: session.billedAmount,
      completedAt: new Date()
    });
    
    return res.status(200).json({
      success: true,
      session,
      message: 'Session ended successfully'
    });
    
  } catch (error: any) {
    log(`Error ending pay-per-minute session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to end session', details: error.message });
  }
});

/**
 * Extend a pay-per-minute session 
 * 
 * This endpoint handles adding more time to an active session
 */
router.post('/extend', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, additionalMinutes = 5 } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    
    if (additionalMinutes <= 0) {
      return res.status(400).json({ error: 'Additional minutes must be greater than 0' });
    }
    
    // Get session from database
    const session = await mongodb.Session.findOne({ roomId: sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if session is active
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }
    
    // Get user from request
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Only the client can extend a session
    if (session.clientId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Only the client can extend a session' });
    }
    
    // Calculate additional amount needed
    const additionalAmount = additionalMinutes * session.minuteRate;
    
    // Check if client has enough balance
    const clientBalance = await mongodb.ClientBalance.findOne({ clientId: req.user.id });
    if (!clientBalance) {
      return res.status(400).json({ error: 'Client balance not found' });
    }
    
    if (clientBalance.balance < additionalAmount) {
      return res.status(400).json({ 
        error: 'Insufficient funds', 
        balance: clientBalance.balance,
        required: additionalAmount,
        needsTopup: true
      });
    }
    
    // Update client balance
    clientBalance.balance -= additionalAmount;
    clientBalance.lockedAmount += additionalAmount;
    await clientBalance.save();
    
    // Update session
    session.initialDuration += additionalMinutes;
    session.remainingMinutes += additionalMinutes;
    session.authorizedAmount += additionalAmount;
    await session.save();
    
    return res.status(200).json({
      success: true,
      session,
      message: `Session extended by ${additionalMinutes} minutes`
    });
    
  } catch (error: any) {
    log(`Error extending pay-per-minute session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to extend session', details: error.message });
  }
});

export default router;