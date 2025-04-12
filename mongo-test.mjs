import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

async function run() {
  console.log("=== Setting up in-memory MongoDB ===");
  
  // Create in-memory MongoDB server
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  console.log(`In-memory MongoDB running at: ${uri}`);
  
  const client = new MongoClient(uri);
  
  try {
    // Connect to the in-memory MongoDB server
    await client.connect();
    console.log("✓ Successfully connected to in-memory MongoDB!");
    
    // Create test collection
    const db = client.db("test");
    const collection = db.collection("users");
    
    // Insert test documents
    await collection.insertMany([
      { 
        username: 'admin', 
        email: 'emilynnj14@gmail.com', 
        password: 'hashedPassword', 
        role: 'admin',
        fullName: 'Admin User'
      },
      { 
        username: 'reader', 
        email: 'emilynn992@gmail.com', 
        password: 'hashedPassword', 
        role: 'reader',
        fullName: 'Reader User'
      },
      { 
        username: 'client', 
        email: 'emily81292@gmail.com', 
        password: 'hashedPassword', 
        role: 'client',
        fullName: 'Client User'
      }
    ]);
    
    // Verify the data was inserted
    const users = await collection.find({}).toArray();
    console.log(`✓ Successfully inserted ${users.length} users into the in-memory database`);
    
    // List databases
    const admin = client.db("admin");
    const dbList = await admin.command({ listDatabases: 1 });
    console.log("\nIn-memory Databases:");
    dbList.databases.forEach(db => console.log(` - ${db.name}`));
    
    return true;
  } catch (error) {
    console.error("✗ In-memory MongoDB Error:", error);
    return false;
  } finally {
    await client.close();
    // Don't stop the server - let it keep running
    console.log("✓ In-memory MongoDB setup complete and ready for use");
  }
}

// Run the test
run().catch(console.error);