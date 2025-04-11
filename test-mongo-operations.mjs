import { MongoClient } from 'mongodb';

// Using the connection string with the new password
const uri = "mongodb+srv://emilynnjj:fjbA7G7TEVmqmwDQ@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoDB client
const client = new MongoClient(uri);

async function run() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    
    // Test connection with ping
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB Atlas!");
    
    // List all databases
    console.log("\nListing all databases:");
    const dbList = await client.db().admin().listDatabases();
    dbList.databases.forEach(db => console.log(` - ${db.name}`));
    
    // Select a database to work with
    const testDb = client.db('soulseer');
    
    // Check for existing collections
    console.log("\nListing collections in the soulseer database:");
    const collections = await testDb.listCollections().toArray();
    if (collections.length === 0) {
      console.log("No collections found. Creating a test collection...");
      
      // Create a test collection with sample data
      const testCollection = testDb.collection('test');
      const result = await testCollection.insertOne({
        name: "Test Document",
        createdAt: new Date(),
        message: "Successfully connected to MongoDB Atlas!"
      });
      
      console.log(`Inserted document with _id: ${result.insertedId}`);
    } else {
      collections.forEach(collection => console.log(` - ${collection.name}`));
      
      // Count documents in collections
      for (const collection of collections) {
        const count = await testDb.collection(collection.name).countDocuments();
        console.log(`Collection '${collection.name}' has ${count} documents`);
      }
    }
    
    console.log("\nMongoDB Atlas connection and operations successful!");
  } catch (error) {
    console.error("Error with MongoDB operations:");
    console.error(`Name: ${error.name}`);
    console.error(`Message: ${error.message}`);
    if (error.code) console.error(`Code: ${error.code}`);
    if (error.codeName) console.error(`CodeName: ${error.codeName}`);
  } finally {
    await client.close();
    console.log("Connection closed");
  }
}

run().catch(console.dir);