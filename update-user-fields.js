/**
 * Script to update user accounts with all required fields for the SoulSeer application
 */
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import 'dotenv/config';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_PASSWORD 
  ? `mongodb+srv://emilynnjj:${process.env.MONGODB_PASSWORD}@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority&appName=SSRETRY3`
  : process.env.MONGODB_URI || 'mongodb+srv://emilynnjj:QsFLZ4L4DJSQYSP9@cluster0.npldm3y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('Connecting to MongoDB...');

// User schema (matching the complete schema from mongodb.ts)
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  fullName: String,
  role: { type: String, enum: ['admin', 'user', 'reader', 'client'], default: 'user' },
  profileImage: String,
  bio: String,
  
  // Account status
  isVerified: { type: Boolean, default: false },
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: false },
  
  // Payment information
  stripeCustomerId: String,
  stripeConnectId: String,
  
  // Reader-specific fields
  specialties: [String], 
  yearsOfExperience: Number,
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewCount: { type: Number, default: 0 },
  
  // Reader pricing (in cents)
  pricingVideo: { type: Number, default: 0 },
  pricingVoice: { type: Number, default: 0 },
  pricingChat: { type: Number, default: 0 },
  minimumSessionLength: { type: Number, default: 5 },
  
  // Reader statistics
  completedReadings: { type: Number, default: 0 },
  totalReadingMinutes: { type: Number, default: 0 },
  
  // User preferences & settings
  preferences: { type: Map, of: mongoose.Schema.Types.Mixed },
  notificationSettings: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  
  // Account balance (for quick reference)
  accountBalance: { type: Number, default: 0 },
  
  // Timestamps
  lastActive: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Reader Balance Schema
const readerBalanceSchema = new mongoose.Schema({
  readerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 }, // Available balance in cents
  lifetimeEarnings: { type: Number, default: 0 }, // Total lifetime earnings
  lastPayout: { type: Date }, // Date of last payout
  payoutAccount: { type: String }, // External payout account ID (e.g., Stripe Connect)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Client Balance Schema
const clientBalanceSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 }, // Available balance in cents
  lockedAmount: { type: Number, default: 0 }, // Amount locked for active sessions
  lastTopupAmount: { type: Number }, // Amount of last topup
  lastTopupDate: { type: Date }, // Date of last topup
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create models
const User = mongoose.model('User', userSchema);
const ReaderBalance = mongoose.model('ReaderBalance', readerBalanceSchema);
const ClientBalance = mongoose.model('ClientBalance', clientBalanceSchema);

async function updateUserFields() {
  try {
    // Get all users
    const users = await User.find();
    console.log(`Found ${users.length} users to update`);

    for (const user of users) {
      const updates = {};
      const userId = user._id;

      // Set default values if not already set
      if (!user.profileImage) {
        updates.profileImage = `/images/users/default-${user.role || 'user'}.jpg`;
      }

      if (!user.lastActive) {
        updates.lastActive = new Date();
      }

      // Update role-specific fields
      if (user.role === 'reader') {
        // Reader-specific fields
        if (!user.specialties || user.specialties.length === 0) {
          updates.specialties = ['Tarot', 'Mediumship', 'Energy Healing', 'Astrology', 'Clairvoyance'];
        }

        if (!user.bio || user.bio.length < 10) {
          updates.bio = 'Professional psychic and spiritual advisor with years of experience helping clients find clarity and guidance.';
        }

        // Ensure pricing fields are set for readers
        if (!user.pricingVideo || user.pricingVideo === 0) {
          updates.pricingVideo = 200; // $2.00 per minute
        }

        if (!user.pricingVoice || user.pricingVoice === 0) {
          updates.pricingVoice = 150; // $1.50 per minute
        }

        if (!user.pricingChat || user.pricingChat === 0) {
          updates.pricingChat = 100; // $1.00 per minute
        }

        if (!user.yearsOfExperience) {
          updates.yearsOfExperience = Math.floor(Math.random() * 10) + 3; // Random 3-12 years
        }

        if (user.rating === 0) {
          updates.rating = 4.5; // Default good rating
        }

        if (user.accountBalance === 0) {
          updates.accountBalance = 2500; // Example: $25.00 initial balance
        }
        
        updates.minimumSessionLength = 5; // Minimum 5 minutes
        updates.isAvailable = true; // Set reader as available by default

        // Create or update reader balance
        try {
          const existingBalance = await ReaderBalance.findOne({ readerId: userId });
          
          if (!existingBalance) {
            const readerBalance = new ReaderBalance({
              readerId: userId,
              balance: updates.accountBalance || 2500,
              lifetimeEarnings: 5000, // Example: $50.00 lifetime earnings
              lastPayout: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last month
              payoutAccount: 'acct_' + Math.random().toString(36).substring(2, 15)
            });
            
            await readerBalance.save();
            console.log(`Created reader balance for ${user.email}`);
          } else {
            // Update existing balance
            existingBalance.balance = updates.accountBalance || 2500;
            if (!existingBalance.lifetimeEarnings) existingBalance.lifetimeEarnings = 5000;
            await existingBalance.save();
            console.log(`Updated reader balance for ${user.email}`);
          }
        } catch (error) {
          console.error(`Error with reader balance for ${user.email}:`, error.message);
        }
      } 
      else if (user.role === 'client' || user.role === 'user') {
        // Client-specific updates
        if (!user.bio || user.bio.length < 10) {
          updates.bio = 'Seeking spiritual guidance and insight for life\'s journey.';
        }

        if (user.accountBalance === 0) {
          updates.accountBalance = 5000; // Example: $50.00 initial balance for clients
        }

        // Create or update client balance
        try {
          const existingBalance = await ClientBalance.findOne({ clientId: userId });
          
          if (!existingBalance) {
            const clientBalance = new ClientBalance({
              clientId: userId,
              balance: updates.accountBalance || 5000,
              lockedAmount: 0,
              lastTopupAmount: updates.accountBalance || 5000,
              lastTopupDate: new Date()
            });
            
            await clientBalance.save();
            console.log(`Created client balance for ${user.email}`);
          } else {
            // Update existing balance
            existingBalance.balance = updates.accountBalance || 5000;
            if (!existingBalance.lastTopupAmount) existingBalance.lastTopupAmount = 5000;
            if (!existingBalance.lastTopupDate) existingBalance.lastTopupDate = new Date();
            await existingBalance.save();
            console.log(`Updated client balance for ${user.email}`);
          }
        } catch (error) {
          console.error(`Error with client balance for ${user.email}:`, error.message);
        }
      }

      // Update user with new fields if there are any updates
      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: userId }, { $set: updates });
        console.log(`Updated user fields for ${user.email}`);
      } else {
        console.log(`No updates needed for ${user.email}`);
      }
    }

    console.log('All users updated successfully');
  } catch (error) {
    console.error('Error updating users:', error);
  }
}

// Connect to MongoDB and run the update
async function main() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4
    });
    
    console.log('Connected to MongoDB successfully');
    
    // Update user fields
    await updateUserFields();
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the main function
main().catch(console.error);