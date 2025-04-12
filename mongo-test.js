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
    // Connect the client to the server (optional starting in v4.7)
    console.log("Connecting to MongoDB...");
    await client.connect();
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    // List databases
    const dbList = await client.db().admin().listDatabases();
    console.log("Databases:");
    dbList.databases.forEach(db => console.log(` - ${db.name}`));
    
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}

run().catch(console.dir);