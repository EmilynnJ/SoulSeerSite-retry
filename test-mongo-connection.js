import { MongoClient, ServerApiVersion } from 'mongodb';
const uri = "mongodb+srv://emilynnjj:dblVE7I0xlx8fWSI@cluster0.q84zjg1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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
    console.log("Attempting to connect to MongoDB Atlas...");
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    
    // List all databases
    const databasesList = await client.db().admin().listDatabases();
    console.log("Databases:");
    databasesList.databases.forEach(db => console.log(` - ${db.name}`));
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log("Connection closed");
  }
}
run().catch(console.dir);