import { MongoClient } from 'mongodb';

// Using the exact connection string format from the screenshot
const uri = "mongodb+srv://emilynnjj:dblVE7I0xlx8fWSI@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority";
console.log("Using connection string:", uri);

// Create a simple client (similar to the one in the screenshot)
const client = new MongoClient(uri);

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    // Connect to the server
    await client.connect();
    
    // Send a ping
    console.log("Attempting to ping MongoDB...");
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    // Try listing databases
    console.log("Listing databases...");
    const dbList = await client.db().admin().listDatabases();
    console.log("Available databases:");
    dbList.databases.forEach(db => console.log(` - ${db.name}`));
    
  } catch (err) {
    console.error("Error connecting to MongoDB:");
    console.error(`Name: ${err.name}`);
    console.error(`Message: ${err.message}`);
    console.error(`Code: ${err.code}`);
    if (err.codeName) console.error(`CodeName: ${err.codeName}`);
  } finally {
    // Close the connection
    await client.close();
    console.log("Connection closed");
  }
}

run().catch(console.dir);