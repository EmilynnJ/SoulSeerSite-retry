import { Request, Response, Router } from 'express';
import { User, Reading, Session, Payment, ClientBalance } from '../mongodb';
import mongoose from 'mongoose';
import { log } from '../server-only';
import Stripe from 'stripe';
import { getStripeClient } from '../services/stripe-client';
import { MongoUser, MongoSession, MongoReading, MongoPayment, MongoClientBalance } from '../types/mongoose';
import crypto from 'crypto';

// User type declaration with proper types
declare global {
  namespace Express {
    interface User {
      _id: mongoose.Types.ObjectId;
      id?: number;
      username: string;
      role: "client" | "reader" | "admin";
      email: string;
      fullName: string;
      profileImage?: string | null;
    }
  }
}

// Set up Stripe client
const stripe = getStripeClient();

const router = Router();

/**
 * Middleware to authenticate users
 */
const authenticate = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  log(`Authenticating user: ${JSON.stringify(req.user)}`, 'debug');
  
  // Ensure the user object has the necessary MongoDB _id property
  if (!req.user._id && req.user.id) {
    try {
      // If user has a numeric ID from the old system, convert it to string for MongoDB
      const idStr = req.user.id.toString();
      
      // Try to find the user in MongoDB using the converted ID
      User.findOne({ id: parseInt(idStr) })
        .then(mongoUser => {
          if (mongoUser) {
            // Found the user in MongoDB, use their MongoDB _id
            req.user._id = mongoUser._id;
            log(`Found MongoDB user with ID ${mongoUser._id} for user ${req.user.username}`, 'debug');
            next();
          } else {
            // Create a fallback ObjectId from the numeric ID
            req.user._id = new mongoose.Types.ObjectId();
            log(`Created fallback ObjectId ${req.user._id} for user ${req.user.username}`, 'debug');
            next();
          }
        })
        .catch(err => {
          log(`Error finding MongoDB user: ${err.message}`, 'error');
          // Fallback: create an ObjectId from the numeric ID
          req.user._id = new mongoose.Types.ObjectId();
          next();
        });
    } catch (err: any) {
      log(`Error in authentication middleware: ${err.message}`, 'error');
      req.user._id = new mongoose.Types.ObjectId();
      next();
    }
  } else {
    // User already has a MongoDB _id
    next();
  }
};

/**
 * Initialize a pay-per-minute session
 * POST /api/sessions/initialize
 */
router.post('/initialize', authenticate, async (req: Request, res: Response) => {
  try {
    const { readerId, type, initialDuration = 5 } = req.body;
    
    if (!readerId) {
      return res.status(400).json({ error: 'Reader ID is required' });
    }
    
    if (!['video', 'audio', 'chat'].includes(type)) {
      return res.status(400).json({ error: 'Invalid session type' });
    }
    
    const clientId = req.user!._id;
    
    // Find the reader
    const reader = await User.findById(readerId);
    if (!reader) {
      return res.status(404).json({ error: 'Reader not found' });
    }
    
    if (reader.role !== 'reader') {
      return res.status(400).json({ error: 'Selected user is not a reader' });
    }
    
    if (reader.isOnline !== true) {
      return res.status(400).json({ error: 'Reader is currently offline' });
    }

    // Get reader's rate per minute (in cents)
    const ratePerMinute = reader.ratePerMinute || 500; // Default to $5.00 per minute
    
    // Calculate initial amount to authorize (initialDuration minutes)
    const initialAmount = ratePerMinute * initialDuration;
    
    // Verify client has sufficient balance
    const clientBalance = await ClientBalance.findOne({ clientId });
    if (!clientBalance || clientBalance.balance < initialAmount) {
      return res.status(400).json({ 
        error: 'Insufficient balance', 
        requiredAmount: initialAmount,
        currentBalance: clientBalance?.balance || 0
      });
    }
    
    // Lock the initial amount from client's balance
    await ClientBalance.findOneAndUpdate(
      { clientId },
      { 
        $inc: { 
          balance: -initialAmount,
          lockedAmount: initialAmount
        }
      },
      { new: true }
    );
    
    // Create a unique room ID for the session
    const roomId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Create a new reading record
    const reading = await Reading.create({
      clientId,
      readerId,
      type,
      status: 'in_progress',
      duration: 0, // Will be updated as session progresses
      totalAmount: 0, // Will be updated as session progresses
      roomId,
      scheduledAt: new Date(),
      clientNotes: 'Pay-per-minute session'
    });
    
    // Create a new session record with minute tracking
    const session = await Session.create({
      readingId: reading._id,
      clientId,
      readerId,
      type,
      status: 'initialized',
      startTime: new Date(),
      minuteRate: ratePerMinute,
      authorizedAmount: initialAmount,
      billedAmount: 0,
      lastBillingTime: new Date(),
      roomId,
      initialDuration: initialDuration,
      remainingMinutes: initialDuration,
      provider: type === 'chat' ? 'internal' : 'zego',
      connectionDetails: {
        roomId
      }
    });
    
    return res.status(200).json({ 
      success: true, 
      session,
      reading,
      ratePerMinute,
      initialDuration,
      authorizedAmount: initialAmount,
      roomId
    });
    
  } catch (error: any) {
    log(`Error initializing pay-per-minute session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to initialize session', details: error.message });
  }
});

/**
 * Start a pay-per-minute session
 * POST /api/sessions/start
 */
router.post('/start', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Find the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify user is part of this session
    const userId = req.user!._id;
    if (!userId.equals(session.clientId) && !userId.equals(session.readerId)) {
      return res.status(403).json({ error: 'You are not authorized to access this session' });
    }
    
    // Update session status
    session.status = 'active';
    session.startTime = new Date();
    session.lastBillingTime = new Date();
    await session.save();
    
    // Update the reading status
    await Reading.findByIdAndUpdate(session.readingId, {
      status: 'in_progress'
    });
    
    return res.status(200).json({ 
      success: true, 
      session,
      message: 'Session started successfully'
    });
    
  } catch (error: any) {
    log(`Error starting pay-per-minute session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to start session', details: error.message });
  }
});

/**
 * Update a pay-per-minute session (heartbeat)
 * POST /api/sessions/update
 */
router.post('/update', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, elapsedMinutes = 1 } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Find the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify user is part of this session
    const userId = req.user!._id;
    if (!userId.equals(session.clientId) && !userId.equals(session.readerId)) {
      return res.status(403).json({ error: 'You are not authorized to access this session' });
    }
    
    // Only active sessions can be updated
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }
    
    // Calculate time since last billing
    const now = new Date();
    const lastBilling = new Date(session.lastBillingTime);
    const minutesSinceLastBilling = Math.floor((now.getTime() - lastBilling.getTime()) / (60 * 1000));
    
    // Calculate minutes to bill (cap at authorized amount)
    const minutesToBill = Math.min(
      elapsedMinutes, 
      Math.max(0, session.remainingMinutes - session.billedMinutes)
    );
    
    if (minutesToBill <= 0) {
      // No minutes to bill, client needs to authorize more
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
    
    // Check if we're approaching the limit of authorized minutes
    const remainingMinutes = session.initialDuration - session.billedMinutes;
    session.remainingMinutes = remainingMinutes;
    
    const needsMoreFunds = remainingMinutes <= 2; // Alert when less than 2 minutes remain
    
    await session.save();
    
    // Update the reading with current duration and amount
    await Reading.findByIdAndUpdate(session.readingId, {
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
 * Extend a pay-per-minute session with more minutes
 * POST /api/sessions/extend
 */
router.post('/extend', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, additionalMinutes = 5 } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    if (additionalMinutes <= 0) {
      return res.status(400).json({ error: 'Additional minutes must be greater than zero' });
    }
    
    // Find the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Only clients can extend sessions
    const clientId = req.user!._id;
    if (!clientId.equals(session.clientId)) {
      return res.status(403).json({ error: 'Only clients can extend sessions' });
    }
    
    // Only active sessions can be extended
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }
    
    // Calculate amount needed for extension
    const additionalAmount = additionalMinutes * session.minuteRate;
    
    // Verify client has sufficient balance
    const clientBalance = await ClientBalance.findOne({ clientId });
    if (!clientBalance || clientBalance.balance < additionalAmount) {
      return res.status(400).json({ 
        error: 'Insufficient balance', 
        requiredAmount: additionalAmount,
        currentBalance: clientBalance?.balance || 0
      });
    }
    
    // Lock the additional amount from client's balance
    await ClientBalance.findOneAndUpdate(
      { clientId },
      { 
        $inc: { 
          balance: -additionalAmount,
          lockedAmount: additionalAmount
        }
      },
      { new: true }
    );
    
    // Update session with extended authorization
    session.authorizedAmount += additionalAmount;
    session.initialDuration += additionalMinutes;
    session.remainingMinutes += additionalMinutes;
    await session.save();
    
    return res.status(200).json({ 
      success: true, 
      session,
      additionalMinutes,
      additionalAmount,
      newRemainingMinutes: session.remainingMinutes,
      message: 'Session extended successfully'
    });
    
  } catch (error: any) {
    log(`Error extending pay-per-minute session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to extend session', details: error.message });
  }
});

/**
 * End a pay-per-minute session
 * POST /api/sessions/end
 */
router.post('/end', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, reason } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Find the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify user is part of this session
    const userId = req.user!._id;
    if (!userId.equals(session.clientId) && !userId.equals(session.readerId)) {
      return res.status(403).json({ error: 'You are not authorized to access this session' });
    }
    
    // Only active or initialized sessions can be ended
    if (session.status !== 'active' && session.status !== 'initialized') {
      return res.status(400).json({ error: 'Session is already ended' });
    }
    
    const endTime = new Date();
    
    // Update session status
    session.status = 'completed';
    session.endTime = endTime;
    session.endedBy = userId;
    session.endReason = reason || 'User ended session';
    await session.save();
    
    // Update the reading status and details
    const reading = await Reading.findByIdAndUpdate(
      session.readingId,
      {
        status: 'completed',
        duration: session.billedMinutes,
        totalAmount: session.billedAmount,
        completedAt: endTime
      },
      { new: true }
    );
    
    // Calculate final billing if session was active
    if (session.status === 'active') {
      // Calculate remaining locked amount to refund
      const refundAmount = session.authorizedAmount - session.billedAmount;
      
      if (refundAmount > 0) {
        // Refund unused locked amount to client's balance
        await ClientBalance.findOneAndUpdate(
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
        
        await Payment.create({
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
        
        // Update reader earnings
        await User.findByIdAndUpdate(
          session.readerId,
          { $inc: { earnings: readerShare } }
        );
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      session,
      reading,
      message: 'Session ended successfully'
    });
    
  } catch (error: any) {
    log(`Error ending pay-per-minute session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to end session', details: error.message });
  }
});

/**
 * Get active session for a user
 * GET /api/sessions/active
 */
router.get('/active', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    
    // Find active session where user is either client or reader
    const session = await Session.findOne({
      $or: [
        { clientId: userId },
        { readerId: userId }
      ],
      status: { $in: ['initialized', 'active'] }
    }).sort({ startTime: -1 });
    
    if (!session) {
      return res.status(404).json({ error: 'No active session found' });
    }
    
    // Get associated reading
    const reading = await Reading.findById(session.readingId);
    
    // Get user details
    const isClient = userId.equals(session.clientId);
    const otherUserId = isClient ? session.readerId : session.clientId;
    const otherUser = await User.findById(otherUserId, 'username fullName profileImage');
    
    return res.status(200).json({ 
      success: true, 
      session,
      reading,
      otherUser,
      isClient
    });
    
  } catch (error: any) {
    log(`Error getting active session: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get active session', details: error.message });
  }
});

/**
 * Get session history for a user
 * GET /api/sessions/history
 */
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { role } = req.user!;
    const { limit = 10, offset = 0 } = req.query;
    
    // Determine field to query based on user role
    const query = role === 'reader' 
      ? { readerId: userId } 
      : { clientId: userId };
    
    // Find completed sessions
    const sessions = await Session.find({
      ...query,
      status: 'completed'
    })
    .sort({ endTime: -1 })
    .skip(Number(offset))
    .limit(Number(limit));
    
    // Get total count
    const total = await Session.countDocuments({
      ...query,
      status: 'completed'
    });
    
    // Get associated readings and other user details
    const sessionsWithDetails = await Promise.all(sessions.map(async (session) => {
      const reading = await Reading.findById(session.readingId);
      
      const otherUserId = role === 'reader' ? session.clientId : session.readerId;
      const otherUser = await User.findById(otherUserId, 'username fullName profileImage');
      
      return {
        ...session.toObject(),
        reading,
        otherUser
      };
    }));
    
    return res.status(200).json({ 
      success: true, 
      sessions: sessionsWithDetails,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
    
  } catch (error: any) {
    log(`Error getting session history: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get session history', details: error.message });
  }
});

/**
 * Get session details by ID
 * GET /api/sessions/:id
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    
    // Find the session
    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify user is part of this session
    if (!userId.equals(session.clientId) && !userId.equals(session.readerId) && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to access this session' });
    }
    
    // Get associated reading
    const reading = await Reading.findById(session.readingId);
    
    // Get user details
    const isClient = userId.equals(session.clientId);
    const otherUserId = isClient ? session.readerId : session.clientId;
    const otherUser = await User.findById(otherUserId, 'username fullName profileImage bio');
    
    // Get any payment associated with this session
    const payment = await Payment.findOne({ readingId: session.readingId });
    
    return res.status(200).json({ 
      success: true, 
      session,
      reading,
      otherUser,
      payment,
      isClient
    });
    
  } catch (error: any) {
    log(`Error getting session details: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get session details', details: error.message });
  }
});

/**
 * Add funds to client balance (DEVELOPMENT VERSION)
 * This simplified version skips Stripe integration for testing purposes
 * POST /api/sessions/add-funds
 */
router.post('/add-funds', authenticate, async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    const userId = req.user!._id;
    
    log(`Adding funds for user: ${userId}, amount: ${amount}`, 'debug');
    
    if (!amount || amount < 100) { // Minimum $1.00
      return res.status(400).json({ error: 'Amount must be at least $1.00' });
    }
    
    // Find user in MongoDB
    let user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    log(`Found user for adding funds: ${user.username}`, 'debug');
    
    // Check if client balance exists
    let clientBalance = await ClientBalance.findOne({ clientId: userId });
    
    if (!clientBalance) {
      // Create new client balance
      log(`Creating new client balance for user ${user.username} with amount ${amount}`, 'debug');
      clientBalance = await ClientBalance.create({
        clientId: userId,
        balance: amount,
        lockedAmount: 0,
        lastTopupAmount: amount,
        lastTopupDate: new Date()
      });
    } else {
      // Update existing client balance
      log(`Updating client balance for user ${user.username}. Current balance: ${clientBalance.balance}, adding: ${amount}`, 'debug');
      clientBalance.balance += amount;
      clientBalance.lastTopupAmount = amount;
      clientBalance.lastTopupDate = new Date();
      await clientBalance.save();
    }
    
    // Create payment record
    await Payment.create({
      userId,
      readerId: null, // No reader involved in adding funds
      amount,
      status: 'completed',
      type: 'add_funds',
      readerShare: 0, // No reader share for adding funds
      platformFee: 0, // No platform fee for adding funds
      metadata: {
        method: 'test_payment'
      }
    });
    
    log(`Successfully added ${amount} to balance for user ${user.username}. New balance: ${clientBalance.balance}`, 'debug');
    
    return res.status(200).json({ 
      success: true, 
      balance: clientBalance.balance,
      amount,
      message: 'Funds added successfully'
    });
    
  } catch (error: any) {
    log(`Error adding funds: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to add funds', details: error.message });
  }
});

/**
 * Get client balance
 * GET /api/sessions/balance
 */
router.get('/balance', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    
    // Log user ID for debugging
    log(`Getting balance for user ID: ${userId}`, 'debug');
    
    // Get client balance
    let clientBalance = await ClientBalance.findOne({ clientId: userId });
    
    if (!clientBalance) {
      // Create new client balance with zero
      log(`Creating new balance for user ID: ${userId}`, 'debug');
      clientBalance = await ClientBalance.create({
        clientId: userId,
        balance: 0,
        lockedAmount: 0
      });
    }
    
    log(`Balance for user ID ${userId}: ${clientBalance.balance}`, 'debug');
    
    return res.status(200).json({ 
      success: true, 
      balance: clientBalance.balance,
      lockedAmount: clientBalance.lockedAmount,
      lastTopupAmount: clientBalance.lastTopupAmount,
      lastTopupDate: clientBalance.lastTopupDate
    });
    
  } catch (error: any) {
    log(`Error getting client balance: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get client balance', details: error.message });
  }
});

/**
 * Generate Zego token for video/audio call
 * POST /api/sessions/token
 */
router.post('/token', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, roomId } = req.body;
    
    if (!sessionId || !roomId) {
      return res.status(400).json({ error: 'Session ID and Room ID are required' });
    }
    
    // Get environment variables
    const appID = parseInt(process.env.ZEGO_VIDEO_APP_ID || '0');
    const serverSecret = process.env.ZEGO_VIDEO_SERVER_SECRET || '';
    
    if (appID === 0 || !serverSecret) {
      log('Missing ZEGO_VIDEO_APP_ID or ZEGO_VIDEO_SERVER_SECRET environment variables', 'error');
      return res.status(500).json({ error: 'ZegoCloud configuration is missing' });
    }
    
    // Find the session
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify user is part of this session
    const userId = req.user!._id;
    if (!userId.equals(session.clientId) && !userId.equals(session.readerId)) {
      return res.status(403).json({ error: 'You are not authorized to access this session' });
    }
    
    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userIdStr = userId.toString();
    const userName = user.fullName || user.username || 'User';
    
    // Create a token that expires in 1 hour
    const effectiveTimeInSeconds = 3600;
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.floor(Math.random() * 2147483647);
    
    // Payload format required by ZegoCloud
    const payload = {
      ver: 1,
      timestamp,
      nonce,
      app_id: appID,
      user_id: userIdStr,
      user_name: userName,
      room_id: roomId,
      privilege: {
        1: 1, // Login room permission
        2: 1  // Publish stream permission
      },
      stream_id_list: null,
    };
    
    // Generate the token with HMAC-SHA256
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', serverSecret);
    hmac.update(payloadString);
    const token = hmac.digest('base64');
    
    // Log the token generation (with limited info for security)
    log(`Generated Zego token for user ${userIdStr} in room ${roomId} with appID=${appID}`, 'debug');
    
    // Add detailed debug information to help troubleshoot any issues
    log(`Token generation details: timestamp=${timestamp}, nonce=${nonce}, userName=${userName}`, 'debug');
    
    return res.status(200).json({
      success: true,
      token,
      appID,
      userId: userIdStr,
      username: userName,
      roomId
    });
    
  } catch (error: any) {
    log(`Error generating Zego token: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to generate token', details: error.message });
  }
});

export default router;