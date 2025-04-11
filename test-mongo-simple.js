// Using CommonJS module format for compatibility
const { MongoClient } = require('mongodb');

// Create connection string with simplified options
const uri = "mongodb+srv://emilynnjj:dblVE7I0xlx8fWSI@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority";

// Create a simple MongoClient (without the ServerApi settings)
const client = new MongoClient(uri);

async function run() {
  console.log('Attempting connection with simplified options...');
  try {
    // Connect the client to the server
    await client.connect();
    
    // Verify connection with a ping
    await client.db("admin").command({ ping: 1 });
    console.log("Connection successful! MongoDB server responded to ping");
    
    // List available databases
    console.log("Listing databases...");
    const dbList = await client.db().admin().listDatabases();
    console.log("Available databases:");
    dbList.databases.forEach(db => console.log(` - ${db.name}`));
    
    // Success!
    console.log("MongoDB Atlas connection and operations successful!");
  } catch (err) {
    console.error("Connection error:");
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

// Run the test
run().catch(console.dir);