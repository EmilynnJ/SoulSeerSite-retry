import { MongoClient } from 'mongodb';

// MongoDB Atlas connection string with the new password
const uri = "mongodb+srv://emilynnjj:fjbA7G7TEVmqmwDQ@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

// Collection names based on our application schemas
const COLLECTIONS = [
  'users',
  'readings',
  'payments',
  'products',
  'livestreams',
  'orders'
];

// Create indexes for improved query performance
const INDEXES = {
  users: [
    { key: { username: 1 }, unique: true },
    { key: { email: 1 }, unique: true },
    { key: { role: 1 } },
    { key: { isOnline: 1 } }
  ],
  readings: [
    { key: { clientId: 1 } },
    { key: { readerId: 1 } },
    { key: { status: 1 } },
    { key: { type: 1 } },
    { key: { scheduledAt: 1 } }
  ],
  payments: [
    { key: { userId: 1 } },
    { key: { readerId: 1 } },
    { key: { readingId: 1 } },
    { key: { status: 1 } },
    { key: { type: 1 } }
  ],
  products: [
    { key: { sellerId: 1 } },
    { key: { category: 1 } },
    { key: { isFeatured: 1 } }
  ],
  livestreams: [
    { key: { hostId: 1 } },
    { key: { status: 1 } },
    { key: { scheduledAt: 1 } }
  ],
  orders: [
    { key: { userId: 1 } },
    { key: { status: 1 } }
  ]
};

// Initial sample admin user (for basic system access if needed)
const SAMPLE_ADMIN = {
  username: 'admin',
  email: 'admin@soulseer.app',
  password: '$2b$10$K4nTjbGj9Y0xP0HIEwdXOOeDvgOXILf6j7vkdYfvZ3lM9i1U0Acja', // 'admin123'
  fullName: 'Admin User',
  role: 'admin',
  profileImage: '/images/users/admin.jpg',
  bio: 'System administrator',
  isVerified: true,
  isOnline: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

async function initializeCollections() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    console.log("Connection successful!");

    // Get the database
    const db = client.db("soulseer");
    console.log("Using database: soulseer");

    // Get list of existing collections
    const existingCollections = await db.listCollections().toArray();
    const existingCollectionNames = existingCollections.map(c => c.name);
    
    console.log("Existing collections:", existingCollectionNames.length > 0 ? existingCollectionNames.join(", ") : "None");
    
    // Create collections and indexes
    for (const collectionName of COLLECTIONS) {
      // Check if collection already exists
      if (!existingCollectionNames.includes(collectionName)) {
        console.log(`Creating collection: ${collectionName}`);
        await db.createCollection(collectionName);
      } else {
        console.log(`Collection already exists: ${collectionName}`);
      }
      
      // Create indexes for the collection
      const collection = db.collection(collectionName);
      if (INDEXES[collectionName]) {
        for (const index of INDEXES[collectionName]) {
          try {
            console.log(`Creating index on ${collectionName}: ${JSON.stringify(index.key)}`);
            await collection.createIndex(index.key, { unique: index.unique || false });
          } catch (indexError) {
            console.warn(`Error creating index on ${collectionName}: ${indexError.message}`);
          }
        }
      }
    }

    // Check if we already have an admin user
    const usersCollection = db.collection('users');
    const adminCount = await usersCollection.countDocuments({ role: 'admin' });
    
    if (adminCount === 0) {
      console.log("No admin user found. Creating sample admin user.");
      await usersCollection.insertOne(SAMPLE_ADMIN);
      console.log("Admin user created successfully.");
    } else {
      console.log(`Found ${adminCount} existing admin user(s).`);
    }

    console.log("\nMongoDB collections and indexes initialized successfully!");
    
    // Display collection information
    console.log("\nCollection stats:");
    for (const collectionName of COLLECTIONS) {
      const count = await db.collection(collectionName).countDocuments();
      console.log(`- ${collectionName}: ${count} documents`);
    }
    
  } catch (error) {
    console.error("Error initializing MongoDB collections:");
    console.error(error);
  } finally {
    await client.close();
    console.log("\nMongoDB connection closed");
  }
}

// Run the initialization
initializeCollections().catch(console.error);