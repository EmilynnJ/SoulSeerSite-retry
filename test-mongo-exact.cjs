const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://emilynnjj:dblVE7I0xlx8fWSI@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority&appName=SSRETRY3";

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
    console.log("Connecting to MongoDB...");
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    // Try listing available databases
    console.log("Listing databases...");
    const dbList = await client.db().admin().listDatabases();
    console.log("Available databases:");
    dbList.databases.forEach(db => console.log(` - ${db.name}`));
  } catch (err) {
    console.error("Error connecting to MongoDB:");
    console.error(`Name: ${err.name}`);
    console.error(`Message: ${err.message}`);
    console.error(`Code: ${err.code}`);
    console.error(`CodeName: ${err.codeName}`);
    if (err.stack) console.error(`Stack: ${err.stack.substring(0, 200)}...`);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log("Connection closed");
  }
}
run().catch(err => {
  console.error("Unhandled exception:", err);
});