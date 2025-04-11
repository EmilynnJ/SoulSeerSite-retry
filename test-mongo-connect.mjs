import { MongoClient } from 'mongodb';

// Using your connection string
const uri = "mongodb+srv://emilynnjj:dblVE7I0xlx8fWSI@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority&appName=SSRETRY3";

// Create a MongoClient
const client = new MongoClient(uri);

async function run() {
  try {
    console.log("Attempting to connect to MongoDB Atlas...");
    
    // Connect to the server
    await client.connect();
    
    // Verify connection with a ping
    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB Atlas!");
    
    // Try to list databases to verify permissions
    const databasesList = await client.db().admin().listDatabases();
    console.log("Available databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
  } catch (err) {
    console.error("Error connecting to MongoDB Atlas:");
    console.error(`Name: ${err.name}`);
    console.error(`Message: ${err.message}`);
    console.error(`Code: ${err.code}`);
    console.error(`CodeName: ${err.codeName}`);
    if (err.stack) console.error(`Stack: ${err.stack}`);
  } finally {
    await client.close();
    console.log("Connection closed");
  }
}

run();