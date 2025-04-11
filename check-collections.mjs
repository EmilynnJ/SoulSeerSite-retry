import { MongoClient } from 'mongodb';

// MongoDB Atlas connection string
const uri = "mongodb+srv://emilynnjj:fjbA7G7TEVmqmwDQ@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority";

async function checkCollections() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db("soulseer");
    
    console.log("Collection counts in MongoDB Atlas:");
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    
    // Check count for each collection
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`${collection.name}: ${count} documents`);
    }
    
    // Check specific collections that should have seed data
    console.log("\nChecking for seeded data:");
    
    const forumCategories = await db.collection('forum_categories').find({}).toArray();
    console.log(`forum_categories: ${forumCategories.length} (Names: ${forumCategories.map(c => c.name).join(', ')})`);
    
    const virtualGifts = await db.collection('virtual_gifts').find({}).toArray();
    console.log(`virtual_gifts: ${virtualGifts.length} (Names: ${virtualGifts.map(g => g.name).join(', ')})`);
    
    const plans = await db.collection('plans').find({}).toArray();
    console.log(`plans: ${plans.length} (Names: ${plans.map(p => p.name).join(', ')})`);
    
    const users = await db.collection('users').find({}).toArray();
    console.log(`users: ${users.length} (${users.map(u => u.username || 'unnamed').join(', ')})`);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
    console.log("\nConnection closed");
  }
}

checkCollections().catch(console.error);