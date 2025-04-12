/**
 * Script to create specific user accounts for SoulSeer application
 */
import bcrypt from 'bcrypt';
import { MongoClient, ServerApiVersion } from 'mongodb';

// Connection string to MongoDB Atlas
const uri = "mongodb+srv://emilynnjj:QsFLZ4L4DJSQYSP9@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority&appName=SSRETRY3";
// Create a MongoClient with a MongoClientOptions object
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Test users to add
const users = [
  {
    username: "emilynnjadmin",
    email: "emilynnj14@gmail.com",
    password: "JayJas1423!",
    fullName: "Emily Admin",
    role: "admin",
    profileImage: "/images/default-profile.png",
    bio: "SoulSeer platform administrator.",
    isVerified: true,
    isOnline: false,
    pricingVideo: 0,
    pricingVoice: 0,
    pricingChat: 0
  },
  {
    username: "emilynn992",
    email: "emilynn992@gmail.com",
    password: "JayJas1423!",
    fullName: "Emily Reader",
    role: "reader",
    profileImage: "/images/default-profile.png",
    bio: "Experienced psychic medium with focus on tarot readings.",
    specialties: ["Tarot", "Medium", "Spiritual Guidance"],
    yearsOfExperience: 5,
    rating: 4.8,
    reviewCount: 24,
    isVerified: true,
    isOnline: false,
    isAvailable: true,
    pricingVideo: 200, // $2.00/min
    pricingVoice: 150, // $1.50/min
    pricingChat: 100,  // $1.00/min
    minimumSessionLength: 5, // 5 minutes minimum
    completedReadings: 32
  },
  {
    username: "emilyclient",
    email: "emily81292@gmail.com",
    password: "Jade2014!",
    fullName: "Emily Client",
    role: "client",
    profileImage: "/images/default-profile.png",
    bio: "",
    isVerified: true,
    isOnline: false
  }
];

// Hash passwords before storing
async function hashPassword(password) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Create or update a user
async function createOrUpdateUser(userData) {
  try {
    // Hash the password
    const hashedPassword = await hashPassword(userData.password);
    
    // Create user object with hashed password
    const user = {
      ...userData,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Check if user exists
    const db = client.db("soulseer");
    const collection = db.collection("users");
    const existingUser = await collection.findOne({ email: userData.email });
    
    if (existingUser) {
      console.log(`User ${userData.email} already exists. Updating...`);
      const result = await collection.updateOne(
        { email: userData.email },
        { $set: { ...user, _id: existingUser._id } }
      );
      console.log(`User ${userData.email} updated: ${result.modifiedCount} document modified`);
      return existingUser._id;
    } else {
      console.log(`Creating new user: ${userData.email}`);
      const result = await collection.insertOne(user);
      console.log(`User ${userData.email} created with ID: ${result.insertedId}`);
      return result.insertedId;
    }
  } catch (error) {
    console.error(`Error creating/updating user ${userData.email}:`, error);
    throw error;
  }
}

async function main() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected successfully to MongoDB Atlas");
    
    // Create database and collections if they don't exist
    const db = client.db("soulseer");
    console.log("Using database: soulseer");
    
    // Create collections if they don't exist
    const collections = [
      "users", "readings", "payments", "products", 
      "livestreams", "orders", "sessions", 
      "clientbalances", "readerbalances",
      "forumcategories", "forumthreads", "forumposts"
    ];
    
    const existingCollections = await db.listCollections().toArray();
    const existingCollectionNames = existingCollections.map(c => c.name);
    
    for (const collName of collections) {
      if (!existingCollectionNames.includes(collName)) {
        await db.createCollection(collName);
        console.log(`Created collection: ${collName}`);
      } else {
        console.log(`Collection already exists: ${collName}`);
      }
    }
    
    // Create/update users
    for (const userData of users) {
      const userId = await createOrUpdateUser(userData);
      
      // Create balance records for readers and clients
      if (userData.role === 'reader') {
        const readerBalance = {
          readerId: userId,
          currentBalance: 0,
          pendingBalance: 0,
          lifetimeEarnings: 0,
          lastPayoutDate: null,
          lastPayoutAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const readerBalanceCollection = db.collection("readerbalances");
        const existingBalance = await readerBalanceCollection.findOne({ readerId: userId });
        
        if (existingBalance) {
          console.log(`Reader balance record already exists for user ${userData.email}`);
        } else {
          await readerBalanceCollection.insertOne(readerBalance);
          console.log(`Created reader balance record for user ${userData.email}`);
        }
      }
      
      if (userData.role === 'client') {
        const clientBalance = {
          clientId: userId,
          currentBalance: 0,
          lifetimeSpent: 0,
          lastDepositDate: null,
          lastDepositAmount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        const clientBalanceCollection = db.collection("clientbalances");
        const existingBalance = await clientBalanceCollection.findOne({ clientId: userId });
        
        if (existingBalance) {
          console.log(`Client balance record already exists for user ${userData.email}`);
        } else {
          await clientBalanceCollection.insertOne(clientBalance);
          console.log(`Created client balance record for user ${userData.email}`);
        }
      }
    }
    
    console.log("All accounts created/updated successfully!");
  } catch (error) {
    console.error("Error in main function:", error);
  } finally {
    await client.close();
    console.log("MongoDB connection closed");
  }
}

main();