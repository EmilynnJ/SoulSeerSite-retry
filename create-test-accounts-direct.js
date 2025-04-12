/**
 * Script to create test user accounts for SoulSeer application
 * directly using mongodb without the HTTP endpoint
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 10;

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI;

// Connect to MongoDB
async function connectToDatabase() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      socketTimeoutMS: 120000,
      family: 4,
      heartbeatFrequencyMS: 30000,
      maxPoolSize: 5,
      minPoolSize: 1,
      maxIdleTimeMS: 120000,
      retryWrites: true,
      retryReads: true,
      // Buffer commands enabled by default
    });
    console.log('MongoDB Atlas connection successful');
    return mongoose.connection;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error}`);
    throw error;
  }
}

// Define User schema
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
  isAvailable: { type: Boolean, default: false }, // For readers to mark themselves as available for readings
  
  // Payment information
  stripeCustomerId: String,
  stripeConnectId: String,
  
  // Reader-specific fields
  specialties: [String], // Array of reader specialties, e.g., ['Tarot', 'Astrology', 'Channeling']
  yearsOfExperience: Number,
  rating: { type: Number, min: 0, max: 5, default: 0 }, // Average rating from all readings
  reviewCount: { type: Number, default: 0 }, // Number of reviews received
  
  // Reader pricing (in cents)
  pricingVideo: { type: Number, default: 0 }, // per minute rate for video readings
  pricingVoice: { type: Number, default: 0 }, // per minute rate for voice readings
  pricingChat: { type: Number, default: 0 }, // per minute rate for chat readings
  minimumSessionLength: { type: Number, default: 5 }, // Minimum session length in minutes
  
  // Reader statistics
  completedReadings: { type: Number, default: 0 }, // Number of completed readings
  totalReadingMinutes: { type: Number, default: 0 }, // Total minutes spent on readings
  
  // User preferences & settings
  preferences: { type: Map, of: mongoose.Schema.Types.Mixed },
  notificationSettings: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  
  // Account balance (for quick reference, detailed balance in ReaderBalance/ClientBalance)
  accountBalance: { type: Number, default: 0 }, // Current account balance in cents
  
  // Timestamps
  lastActive: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Define Balance schemas
const clientBalanceSchema = new mongoose.Schema({
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  balance: { 
    type: Number, 
    default: 0 
  }, // Amount in cents
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  currency: { 
    type: String, 
    default: 'usd' 
  }
}, { timestamps: true });

const readerBalanceSchema = new mongoose.Schema({
  readerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  availableBalance: { 
    type: Number, 
    default: 0 
  }, // Amount in cents that is available for payout
  pendingBalance: { 
    type: Number, 
    default: 0 
  }, // Amount in cents that is pending (e.g., within holding period)
  lifetimeEarnings: { 
    type: Number, 
    default: 0 
  }, // Total lifetime earnings in cents
  lastPayout: { 
    type: Date 
  },
  nextScheduledPayout: { 
    type: Date 
  },
  payoutMethod: { 
    type: String, 
    enum: ['stripe', 'paypal', 'bank_transfer', null], 
    default: null 
  },
  payoutDetails: { 
    type: Map, 
    of: mongoose.Schema.Types.Mixed 
  }, // Bank account, etc.
  currency: { 
    type: String, 
    default: 'usd' 
  }
}, { timestamps: true });

// Create models
const User = mongoose.models.User || mongoose.model('User', userSchema);
const ClientBalance = mongoose.models.ClientBalance || mongoose.model('ClientBalance', clientBalanceSchema);
const ReaderBalance = mongoose.models.ReaderBalance || mongoose.model('ReaderBalance', readerBalanceSchema);

// Hash a password
async function hashPassword(password) {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
}

// Create or update a user
async function createOrUpdateUser(userData) {
  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email: userData.email });
    
    if (existingUser) {
      console.log(`User with email ${userData.email} already exists. Updating...`);
      
      // Don't re-hash the password if it hasn't changed
      if (userData.password && !userData.password.startsWith('$2b$')) {
        userData.password = await hashPassword(userData.password);
      }
      
      // Update the user
      const updatedUser = await User.findOneAndUpdate(
        { email: userData.email },
        userData,
        { new: true }
      );
      
      return updatedUser;
    } else {
      console.log(`Creating new user with email ${userData.email}...`);
      
      // Hash the password for new users
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      
      // Create the user
      const newUser = await User.create(userData);
      
      // Create associated balance documents for readers and clients
      if (userData.role === 'reader') {
        await ReaderBalance.create({
          readerId: newUser._id,
          availableBalance: 0,
          pendingBalance: 0,
          lifetimeEarnings: 0,
        });
        console.log(`Reader balance created for ${userData.email}`);
      } else if (userData.role === 'client' || userData.role === 'user') {
        await ClientBalance.create({
          clientId: newUser._id,
          balance: 0,
        });
        console.log(`Client balance created for ${userData.email}`);
      }
      
      return newUser;
    }
  } catch (error) {
    console.error(`Error creating/updating user ${userData.email}:`, error);
    throw error;
  }
}

// Main function to create test accounts
async function main() {
  let connection;
  try {
    // Connect to MongoDB
    connection = await connectToDatabase();
    
    console.log('Creating test accounts...');
    
    // Create admin user
    const adminUser = await createOrUpdateUser({
      username: 'emilynnj14',
      email: 'emilynnj14@gmail.com',
      password: 'JayJas1423!',
      fullName: 'Admin User',
      role: 'admin',
      profileImage: '/images/users/admin.jpg',
      bio: 'System administrator',
      isVerified: true,
      isOnline: true
    });
    
    console.log('Admin user created/updated:', adminUser.email);
    
    // Create reader user with specific pricing
    const readerUser = await createOrUpdateUser({
      username: 'emilynn992',
      email: 'emilynn992@gmail.com',
      password: 'JayJas1423!',
      fullName: 'Psychic Reader',
      role: 'reader',
      profileImage: '/images/users/reader.jpg',
      bio: 'Tarot specialist with 10 years of experience in spiritual guidance.',
      isVerified: true,
      isOnline: true,
      isAvailable: true,
      specialties: ['Tarot', 'Mediumship', 'Love Readings'],
      yearsOfExperience: 10,
      pricingVideo: 200, // $2.00 per minute
      pricingVoice: 150, // $1.50 per minute
      pricingChat: 100,  // $1.00 per minute
      minimumSessionLength: 5
    });
    
    console.log('Reader user created/updated:', readerUser.email);
    
    // Create client user
    const clientUser = await createOrUpdateUser({
      username: 'emily81292',
      email: 'emily81292@gmail.com',
      password: 'Jade2014!',
      fullName: 'Client User',
      role: 'client',
      profileImage: null,
      bio: null,
      isVerified: true,
      isOnline: false
    });
    
    console.log('Client user created/updated:', clientUser.email);
    
    console.log('Test accounts creation completed successfully!');
  } catch (error) {
    console.error('Error creating test accounts:', error);
  } finally {
    // Close the connection
    if (connection) {
      await connection.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Run the main function
main();