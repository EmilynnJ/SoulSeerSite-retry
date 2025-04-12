import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  const uri = process.env.MONGODB_URI;
  
  try {
    await mongoose.connect(uri, {
      retryWrites: true,
      retryReads: true
    });
    
    console.log('MongoDB Atlas connection successful');
    
    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available Collections:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Count documents in Users collection
    const userCount = await mongoose.connection.db.collection('users').countDocuments();
    console.log(`Users collection has ${userCount} documents`);
    
    // Show limited user data
    const users = await mongoose.connection.db.collection('users').find({}).limit(5).toArray();
    console.log('Sample users:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.role})`);
    });
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

run().catch(console.error);