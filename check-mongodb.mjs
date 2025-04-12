/**
 * Script to check MongoDB collections and data (ESM version)
 */
import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = "mongodb+srv://emilynnjj:QsFLZ4L4DJSQYSP9@cluster0.q84zjg1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();
    console.log("Connected successfully to MongoDB!");
    
    // Get the database
    const db = client.db("soulseer");
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log("Collections in database:", collections.map(c => c.name));
    
    // Check users collection
    if (collections.some(c => c.name === "users")) {
      const users = db.collection("users");
      const userCount = await users.countDocuments();
      console.log(`Found ${userCount} users in database`);
      
      // Show first 5 users
      if (userCount > 0) {
        const userSample = await users.find().limit(5).toArray();
        console.log("Sample users:");
        userSample.forEach(user => {
          console.log(`- ${user.email} (${user.role})`);
        });
      }
    } else {
      console.log("No 'users' collection found!");
    }
    
    // Check other important collections
    const collections_to_check = [
      "readerbalances", 
      "clientbalances", 
      "readings", 
      "products", 
      "livestreams", 
      "payments",
      "forumcategories",
      "forumthreads",
      "forumposts"
    ];
    
    for (const collName of collections_to_check) {
      try {
        if (collections.some(c => c.name === collName)) {
          const collection = db.collection(collName);
          const count = await collection.countDocuments();
          console.log(`${collName}: ${count} documents`);
          
          // Show sample for non-empty collections
          if (count > 0) {
            const sample = await collection.find().limit(1).toArray();
            console.log(`Sample from ${collName}:`, JSON.stringify(sample[0]._id));
          }
        } else {
          console.log(`Collection '${collName}' does not exist`);
        }
      } catch (err) {
        console.log(`Error checking ${collName}: ${err.message}`);
      }
    }
    
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log("MongoDB connection closed");
  }
}

run().catch(err => {
  console.error("Error running MongoDB check:", err);
});