/**
 * Script to create specific user accounts for SoulSeer application
 */
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import 'dotenv/config';

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_PASSWORD 
  ? `mongodb+srv://emilynnjj:${process.env.MONGODB_PASSWORD}@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority&appName=SSRETRY3`
  : process.env.MONGODB_URI || 'mongodb+srv://emilynnjj:QsFLZ4L4DJSQYSP9@cluster0.npldm3y.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('Connecting to MongoDB...');

// User schema
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
  
  // Account balance
  accountBalance: { type: Number, default: 0 },
  
  // Timestamps
  lastActive: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create User model
const User = mongoose.model('User', userSchema);

// Function to create or update user
async function createOrUpdateUser(userData) {
  try {
    // Check if user exists
    const existingUser = await User.findOne({ email: userData.email });
    
    if (existingUser) {
      console.log(`User with email ${userData.email} already exists. Updating password...`);
      
      // Update password
      existingUser.password = await bcrypt.hash(userData.password, 10);
      await existingUser.save();
      
      console.log(`Updated password for ${userData.email}`);
      return { success: true, user: existingUser, action: 'updated' };
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const newUser = await User.create({
        ...userData,
        password: hashedPassword,
        isVerified: true
      });
      
      console.log(`Created new user: ${userData.email} with role ${userData.role}`);
      return { success: true, user: newUser, action: 'created' };
    }
  } catch (error) {
    console.error(`Error creating/updating user ${userData.email}:`, error);
    return { success: false, error };
  }
}

// Connect to MongoDB and create users
async function main() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000, // Longer timeout to allow for slower connections
      connectTimeoutMS: 30000,         // Longer timeout for initial connection
      socketTimeoutMS: 45000,          // Longer timeout for socket operations
      family: 4                        // Force IPv4 (sometimes helps with connectivity)
    });
    
    console.log('Connected to MongoDB successfully');
    
    // Define users to create/update
    const users = [
      {
        username: 'emilynnj',
        email: 'emilynnj14@gmail.com',
        password: 'JayJas1423!',
        fullName: 'Emily Admin',
        role: 'admin',
        bio: 'SoulSeer Administrator',
        isVerified: true,
        isOnline: true
      },
      {
        username: 'emilynn992',
        email: 'emilynn992@gmail.com',
        password: 'JayJas1423!', 
        fullName: 'Emily Reader',
        role: 'reader',
        bio: 'Professional psychic and spiritual advisor',
        specialties: ['Tarot', 'Mediumship', 'Energy Healing'],
        yearsOfExperience: 8,
        rating: 4.8,
        pricingVideo: 200, // $2.00 per minute
        pricingVoice: 150, // $1.50 per minute
        pricingChat: 100,  // $1.00 per minute
        isVerified: true,
        isOnline: true,
        isAvailable: true
      },
      {
        username: 'emily81292',
        email: 'emily81292@gmail.com',
        password: 'Jade2014!',
        fullName: 'Emily Client',
        role: 'client',
        bio: 'Seeking spiritual guidance',
        isVerified: true,
        isOnline: true
      }
    ];
    
    // Create/update each user
    const results = [];
    for (const userData of users) {
      const result = await createOrUpdateUser(userData);
      results.push(result);
    }
    
    console.log('Operation completed:');
    console.log(results.map(r => `${r.action} ${r.user?.email} (${r.user?.role})`).join('\n'));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the main function
main().catch(console.error);