import mongoose from 'mongoose';

// Define mongoose document types to match our schemas
declare global {
  namespace Express {
    interface User {
      _id: mongoose.Types.ObjectId;
      id?: number;
      username: string;
      email: string;
      fullName: string;
      role: 'client' | 'reader' | 'admin';
      profileImage?: string | null;
      bio?: string | null;
      isOnline?: boolean;
      [key: string]: any; // For other properties
    }
  }
}

// MongoDB User Document Type
export interface MongoUser {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  password: string;
  fullName: string;
  profileImage?: string | null;
  role: 'client' | 'reader' | 'admin';
  bio?: string | null;
  specialties?: string[] | null;
  isOnline: boolean;
  isVerified: boolean;
  ratePerMinute?: number;
  earnings?: number;
  stripeCustomerId?: string | null;
  stripeAccountId?: string | null;
  [key: string]: any; // For other properties
}

// MongoDB Reading Document Type
export interface MongoReading {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  readerId: mongoose.Types.ObjectId;
  type: 'chat' | 'voice' | 'video';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  duration?: number;
  totalAmount?: number;
  roomId?: string;
  scheduledAt: Date;
  completedAt?: Date;
  clientNotes?: string;
  readerNotes?: string;
  [key: string]: any; // For other properties
}

// MongoDB Session Document Type
export interface MongoSession {
  _id: mongoose.Types.ObjectId;
  readingId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  readerId: mongoose.Types.ObjectId;
  type: 'video' | 'audio' | 'chat';
  status: 'initialized' | 'active' | 'paused' | 'completed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  endedBy?: mongoose.Types.ObjectId;
  endReason?: string;
  minuteRate: number;
  initialDuration: number;
  billedMinutes: number;
  remainingMinutes: number;
  authorizedAmount: number;
  billedAmount: number;
  lastBillingTime: Date;
  roomId: string;
  provider: 'zego' | 'livekit' | 'internal';
  connectionDetails?: Map<string, any>;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any; // For other properties
}

// MongoDB Payment Document Type
export interface MongoPayment {
  _id: mongoose.Types.ObjectId;
  readingId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  readerId?: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  type: 'reading' | 'topup' | 'refund' | 'gift';
  readerShare?: number;
  platformFee?: number;
  stripePaymentIntentId?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any; // For other properties
}

// MongoDB ClientBalance Document Type
export interface MongoClientBalance {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  balance: number;
  lockedAmount: number;
  lastTopupAmount?: number;
  lastTopupDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any; // For other properties
}