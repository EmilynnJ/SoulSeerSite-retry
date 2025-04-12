/**
 * Script to create test user accounts for SoulSeer application
 */
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_PASSWORD ? 
  `mongodb+srv://emilynnjj:${process.env.MONGODB_PASSWORD}@cluster0.q84zjg1.mongodb.net/SoulSeer?retryWrites=true&w=majority&appName=Cluster0` :
  'mongodb+srv://emilynnjj:QsFLZ4L4DJSQYSP9@cluster0.q84zjg1.mongodb.net/SoulSeer?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 45000,
  socketTimeoutMS: 60000,
  family: 4,
  heartbeatFrequencyMS: 50000,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
});

// Define schemas for collections
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
  pricingVideo: { type: Number, default: 200 }, // $2.00/min
  pricingVoice: { type: Number, default: 150 }, // $1.50/min
  pricingChat: { type: Number, default: 100 },  // $1.00/min
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
  
  // Account balance
  accountBalance: { type: Number, default: 0 },
  
  // Timestamps
  lastActive: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create User model
const User = mongoose.model('User', userSchema);

// Create Client Balance model
const clientBalanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  balance: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const ClientBalance = mongoose.model('ClientBalance', clientBalanceSchema);

// Create Reader Balance model
const readerBalanceSchema = new mongoose.Schema({
  readerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pendingBalance: { type: Number, default: 0 },
  availableBalance: { type: Number, default: 0 },
  lifetimeEarnings: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const ReaderBalance = mongoose.model('ReaderBalance', readerBalanceSchema);

// Hash password function
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Create user function
async function createOrUpdateUser(userData) {
  try {
    // Hash password if provided
    if (userData.password) {
      userData.password = await hashPassword(userData.password);
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email: userData.email });
    
    if (existingUser) {
      console.log(`Updating existing user: ${userData.email}`);
      // Update existing user
      const updatedUser = await User.findOneAndUpdate(
        { email: userData.email },
        { $set: userData },
        { new: true, runValidators: true }
      );
      return updatedUser;
    } else {
      console.log(`Creating new user: ${userData.email}`);
      // Create new user
      const newUser = await User.create(userData);
      
      // Create balance records
      if (userData.role === 'client') {
        await ClientBalance.create({
          userId: newUser._id,
          balance: 5000 // $50.00 starting balance
        });
      } else if (userData.role === 'reader') {
        await ReaderBalance.create({
          readerId: newUser._id,
          pendingBalance: 0,
          availableBalance: 0,
          lifetimeEarnings: 0
        });
      }
      
      return newUser;
    }
  } catch (error) {
    console.error(`Error creating/updating user ${userData.email}:`, error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log('Creating test accounts...');
    
    // Admin account
    await createOrUpdateUser({
      username: 'admin',
      email: 'emilynnj14@gmail.com',
      password: 'JayJas1423!',
      fullName: 'Admin User',
      role: 'admin',
      profileImage: '/images/users/admin.jpg',
      bio: 'System administrator',
      isVerified: true,
      isOnline: true
    });
    
    // Reader account
    await createOrUpdateUser({
      username: 'psychicreader',
      email: 'emilynn992@gmail.com',
      password: 'JayJas1423!',
      fullName: 'Psychic Reader',
      role: 'reader',
      profileImage: '/images/users/reader.jpg',
      bio: 'Experienced psychic reader specializing in tarot and clairvoyance',
      specialties: ['Tarot', 'Clairvoyance', 'Past Lives'],
      yearsOfExperience: 10,
      rating: 4.8,
      reviewCount: 125,
      pricingVideo: 200, // $2.00/min
      pricingVoice: 150, // $1.50/min
      pricingChat: 100,  // $1.00/min
      minimumSessionLength: 5,
      isVerified: true,
      isOnline: true,
      isAvailable: true
    });
    
    // Client account
    await createOrUpdateUser({
      username: 'client',
      email: 'emily81292@gmail.com',
      password: 'Jade2014!',
      fullName: 'Client User',
      role: 'client',
      profileImage: '/images/users/client.jpg',
      bio: 'Seeking spiritual guidance',
      isVerified: true,
      isOnline: false
    });
    
    console.log('All test accounts created successfully!');
    
  } catch (error) {
    console.error('Error creating test accounts:', error);
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run the script
main();