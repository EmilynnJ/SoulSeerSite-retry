import { MongoClient } from 'mongodb';

// MongoDB Atlas connection string
const uri = "mongodb+srv://emilynnjj:fjbA7G7TEVmqmwDQ@ssretry3.y7soq.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

// Collections that need to be created based on app requirements
const COLLECTIONS_TO_CREATE = [
  // Core collections
  'users',                  // User accounts (already exists)
  'readings',               // Reading sessions (already exists)
  'payments',               // Payment records (already exists)
  'products',               // Shop items (already exists) 
  'orders',                 // Purchase orders (already exists)
  'livestreams',            // Live broadcasts (already exists)
  
  // Additional required collections
  'sessions',               // Active and historical reading sessions with minute tracking
  'virtual_gifts',          // Virtual gifts for livestreams
  'gift_transactions',      // Records of gift purchases and sending
  'forum_categories',       // Community forum categories
  'forum_topics',           // Topics within forum categories
  'forum_posts',            // Individual posts within topics
  'forum_comments',         // Comments on posts
  'reader_applications',    // Applications to become a reader (admin approval)
  'reader_availability',    // Time slots when readers are available
  'reader_earnings',        // Detailed reader earnings tracking
  'client_balances',        // Client prepaid balances for pay-per-minute
  'notifications',          // User notifications
  'messages',               // Direct messages between users
  'reviews',                // Client reviews of readings (separate from reading records)
  'disputes',               // Dispute cases for readings or payments
  'payouts',                // Reader payout history
  'plans',                  // Subscription plan definitions
  'subscriptions',          // User subscriptions
  'promotions',             // Promotional offers and coupons
];

// Define indexes for new collections
const INDEXES = {
  sessions: [
    { key: { clientId: 1 } },
    { key: { readerId: 1 } },
    { key: { status: 1 } },
    { key: { startTime: 1 } },
    { key: { endTime: 1 } }
  ],
  virtual_gifts: [
    { key: { name: 1 } },
    { key: { price: 1 } },
    { key: { category: 1 } }
  ],
  gift_transactions: [
    { key: { senderId: 1 } },
    { key: { recipientId: 1 } },
    { key: { giftId: 1 } },
    { key: { livestreamId: 1 } },
    { key: { timestamp: 1 } }
  ],
  forum_categories: [
    { key: { name: 1 }, unique: true },
    { key: { order: 1 } }
  ],
  forum_topics: [
    { key: { categoryId: 1 } },
    { key: { authorId: 1 } },
    { key: { isPinned: 1 } },
    { key: { createdAt: 1 } }
  ],
  forum_posts: [
    { key: { topicId: 1 } },
    { key: { authorId: 1 } },
    { key: { createdAt: 1 } }
  ],
  forum_comments: [
    { key: { postId: 1 } },
    { key: { authorId: 1 } },
    { key: { createdAt: 1 } }
  ],
  reader_applications: [
    { key: { userId: 1 }, unique: true },
    { key: { status: 1 } },
    { key: { submittedAt: 1 } }
  ],
  reader_availability: [
    { key: { readerId: 1 } },
    { key: { dayOfWeek: 1 } },
    { key: { startTime: 1 } },
    { key: { endTime: 1 } }
  ],
  reader_earnings: [
    { key: { readerId: 1 } },
    { key: { sourceType: 1 } },
    { key: { sourceId: 1 } },
    { key: { date: 1 } }
  ],
  client_balances: [
    { key: { clientId: 1 }, unique: true }
  ],
  notifications: [
    { key: { userId: 1 } },
    { key: { isRead: 1 } },
    { key: { type: 1 } },
    { key: { createdAt: 1 } }
  ],
  messages: [
    { key: { senderId: 1 } },
    { key: { recipientId: 1 } },
    { key: { isRead: 1 } },
    { key: { createdAt: 1 } }
  ],
  reviews: [
    { key: { readerId: 1 } },
    { key: { clientId: 1 } },
    { key: { readingId: 1 }, unique: true },
    { key: { rating: 1 } },
    { key: { createdAt: 1 } }
  ],
  disputes: [
    { key: { readingId: 1 } },
    { key: { clientId: 1 } },
    { key: { readerId: 1 } },
    { key: { status: 1 } },
    { key: { createdAt: 1 } }
  ],
  payouts: [
    { key: { readerId: 1 } },
    { key: { status: 1 } },
    { key: { createdAt: 1 } }
  ],
  plans: [
    { key: { name: 1 }, unique: true },
    { key: { price: 1 } },
    { key: { isActive: 1 } }
  ],
  subscriptions: [
    { key: { userId: 1 } },
    { key: { planId: 1 } },
    { key: { status: 1 } },
    { key: { startDate: 1 } },
    { key: { endDate: 1 } }
  ],
  promotions: [
    { key: { code: 1 }, unique: true },
    { key: { startDate: 1 } },
    { key: { endDate: 1 } },
    { key: { isActive: 1 } }
  ]
};

// Define the schema structures (for documentation)
const SCHEMAS = {
  sessions: {
    _id: "ObjectId",
    clientId: "ObjectId (ref: users)",
    readerId: "ObjectId (ref: users)",
    type: "String (video, audio, chat)",
    status: "String (waiting, connected, disconnected, completed, canceled)",
    startTime: "Date",
    endTime: "Date",
    duration: "Number (minutes)",
    minuteRate: "Number (cents per minute)",
    totalAmount: "Number (cents)",
    roomId: "String",
    lastBillingTime: "Date",
    billingIncrement: "Number (minutes)",
    notes: "String",
    clientFeedback: "Object",
    videoProvider: "String (zego, livekit)",
    connectionDetails: "Object",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  virtual_gifts: {
    _id: "ObjectId",
    name: "String",
    description: "String",
    price: "Number (cents)",
    imageUrl: "String",
    animationUrl: "String",
    category: "String",
    isActive: "Boolean",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  gift_transactions: {
    _id: "ObjectId",
    senderId: "ObjectId (ref: users)",
    recipientId: "ObjectId (ref: users)",
    giftId: "ObjectId (ref: virtual_gifts)",
    quantity: "Number",
    amount: "Number (cents)",
    livestreamId: "ObjectId (ref: livestreams)",
    message: "String",
    timestamp: "Date",
    status: "String (pending, completed, refunded)",
    platformFee: "Number (cents)",
    recipientShare: "Number (cents)",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  forum_categories: {
    _id: "ObjectId",
    name: "String",
    description: "String",
    slug: "String",
    icon: "String",
    order: "Number",
    isActive: "Boolean",
    moderatorIds: "Array of ObjectId (ref: users)",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  forum_topics: {
    _id: "ObjectId",
    categoryId: "ObjectId (ref: forum_categories)",
    title: "String",
    slug: "String",
    authorId: "ObjectId (ref: users)",
    isPinned: "Boolean",
    isLocked: "Boolean",
    viewCount: "Number",
    lastPostAt: "Date",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  forum_posts: {
    _id: "ObjectId",
    topicId: "ObjectId (ref: forum_topics)",
    authorId: "ObjectId (ref: users)",
    content: "String",
    attachments: "Array of Objects",
    isEdited: "Boolean",
    likeCount: "Number",
    commentCount: "Number",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  forum_comments: {
    _id: "ObjectId",
    postId: "ObjectId (ref: forum_posts)",
    authorId: "ObjectId (ref: users)",
    content: "String",
    isEdited: "Boolean",
    likeCount: "Number",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  reader_applications: {
    _id: "ObjectId",
    userId: "ObjectId (ref: users)",
    firstName: "String",
    lastName: "String",
    email: "String",
    phone: "String",
    specialties: "Array of Strings",
    experience: "String",
    bio: "String",
    profileImageUrl: "String",
    status: "String (pending, approved, rejected)",
    adminNotes: "String",
    reviewedBy: "ObjectId (ref: users)",
    reviewedAt: "Date",
    submittedAt: "Date",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  reader_availability: {
    _id: "ObjectId",
    readerId: "ObjectId (ref: users)",
    dayOfWeek: "Number (0-6, Sunday to Saturday)",
    startTime: "String (HH:MM format)",
    endTime: "String (HH:MM format)",
    timeZone: "String",
    isRecurring: "Boolean",
    specificDate: "Date (for non-recurring)",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  reader_earnings: {
    _id: "ObjectId",
    readerId: "ObjectId (ref: users)",
    amount: "Number (cents)",
    sourceType: "String (reading, gift, product)",
    sourceId: "ObjectId",
    date: "Date",
    isPaid: "Boolean",
    payoutId: "ObjectId (ref: payouts)",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  client_balances: {
    _id: "ObjectId",
    clientId: "ObjectId (ref: users)",
    balance: "Number (cents)",
    lockedAmount: "Number (cents, for in-progress sessions)",
    lastTopupAmount: "Number (cents)",
    lastTopupDate: "Date",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  notifications: {
    _id: "ObjectId",
    userId: "ObjectId (ref: users)",
    title: "String",
    message: "String",
    type: "String",
    isRead: "Boolean",
    data: "Object",
    action: "String",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  messages: {
    _id: "ObjectId",
    senderId: "ObjectId (ref: users)",
    recipientId: "ObjectId (ref: users)",
    content: "String",
    attachments: "Array of Objects",
    isRead: "Boolean",
    readAt: "Date",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  reviews: {
    _id: "ObjectId",
    readerId: "ObjectId (ref: users)",
    clientId: "ObjectId (ref: users)",
    readingId: "ObjectId (ref: readings)",
    rating: "Number (1-5)",
    review: "String",
    isPublic: "Boolean",
    readerResponse: "String",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  disputes: {
    _id: "ObjectId",
    readingId: "ObjectId (ref: readings)",
    clientId: "ObjectId (ref: users)",
    readerId: "ObjectId (ref: users)",
    reason: "String",
    description: "String",
    status: "String (opened, under_review, resolved, closed)",
    resolution: "String",
    refundAmount: "Number (cents)",
    adminId: "ObjectId (ref: users, who handled the dispute)",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  payouts: {
    _id: "ObjectId",
    readerId: "ObjectId (ref: users)",
    amount: "Number (cents)",
    status: "String (pending, processed, failed)",
    method: "String (stripe, paypal, bank_transfer)",
    reference: "String",
    notes: "String",
    processedAt: "Date",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  plans: {
    _id: "ObjectId",
    name: "String",
    description: "String",
    price: "Number (cents per month)",
    features: "Array of Strings",
    durationMonths: "Number",
    isActive: "Boolean",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  subscriptions: {
    _id: "ObjectId",
    userId: "ObjectId (ref: users)",
    planId: "ObjectId (ref: plans)",
    status: "String (active, canceled, expired)",
    startDate: "Date",
    endDate: "Date",
    autoRenew: "Boolean",
    stripeSubscriptionId: "String",
    cancelReason: "String",
    createdAt: "Date",
    updatedAt: "Date"
  },
  
  promotions: {
    _id: "ObjectId",
    code: "String",
    description: "String",
    discountType: "String (percentage, fixed_amount)",
    discountValue: "Number",
    minPurchase: "Number (cents)",
    maxUses: "Number",
    usedCount: "Number",
    applyTo: "String (readings, products, all)",
    startDate: "Date",
    endDate: "Date",
    isActive: "Boolean",
    createdAt: "Date",
    updatedAt: "Date"
  }
};

// Forum categories to create for community feature
const FORUM_CATEGORIES = [
  {
    name: "Spiritual Discussions",
    description: "General discussions about spiritual topics and practices",
    slug: "spiritual-discussions",
    icon: "comments",
    order: 1,
    isActive: true
  },
  {
    name: "Psychic Reading Experiences",
    description: "Share and discuss your psychic reading experiences",
    slug: "reading-experiences",
    icon: "crystal-ball",
    order: 2,
    isActive: true
  },
  {
    name: "Meditation & Mindfulness",
    description: "Topics related to meditation practices and mindfulness",
    slug: "meditation-mindfulness",
    icon: "lotus",
    order: 3,
    isActive: true
  },
  {
    name: "Tarot & Divination",
    description: "Discussions about tarot cards, oracle decks, and other divination tools",
    slug: "tarot-divination",
    icon: "tarot",
    order: 4,
    isActive: true
  },
  {
    name: "Reader Corner",
    description: "A space for SoulSeer readers to connect and share insights",
    slug: "reader-corner",
    icon: "users",
    order: 5,
    isActive: true
  }
];

// Virtual gifts for livestream gifting feature
const VIRTUAL_GIFTS = [
  {
    name: "Cosmic Star",
    description: "A sparkling star to light up someone's day",
    price: 499, // $4.99
    imageUrl: "/images/gifts/cosmic-star.png",
    animationUrl: "/animations/gifts/cosmic-star.json",
    category: "Basic",
    isActive: true
  },
  {
    name: "Crystal Heart",
    description: "Show your appreciation with a beautiful crystal heart",
    price: 999, // $9.99
    imageUrl: "/images/gifts/crystal-heart.png",
    animationUrl: "/animations/gifts/crystal-heart.json",
    category: "Premium",
    isActive: true
  },
  {
    name: "Golden Aura",
    description: "Surround someone with a golden aura of positive energy",
    price: 1999, // $19.99
    imageUrl: "/images/gifts/golden-aura.png",
    animationUrl: "/animations/gifts/golden-aura.json",
    category: "Luxury",
    isActive: true
  },
  {
    name: "Mystic Rose",
    description: "A magical rose that never fades",
    price: 799, // $7.99
    imageUrl: "/images/gifts/mystic-rose.png",
    animationUrl: "/animations/gifts/mystic-rose.json",
    category: "Premium",
    isActive: true
  },
  {
    name: "Energy Burst",
    description: "A burst of positive energy",
    price: 299, // $2.99
    imageUrl: "/images/gifts/energy-burst.png",
    animationUrl: "/animations/gifts/energy-burst.json",
    category: "Basic",
    isActive: true
  }
];

// Subscription plans for premium features
const SUBSCRIPTION_PLANS = [
  {
    name: "Basic Access",
    description: "Access to all basic features of SoulSeer",
    price: 0, // Free
    features: ["Book readings", "Join public livestreams", "Browse the shop", "Access community forums"],
    durationMonths: 0, // Unlimited
    isActive: true
  },
  {
    name: "Seeker",
    description: "Enhanced access with special perks for regular clients",
    price: 999, // $9.99/month
    features: ["Priority booking with readers", "Discounted reading rates (5% off)", "Access to premium livestreams", "Exclusive shop discounts"],
    durationMonths: 1,
    isActive: true
  },
  {
    name: "Mystic",
    description: "Premium experience for devoted spiritual seekers",
    price: 1999, // $19.99/month
    features: ["VIP booking with readers", "Discounted reading rates (10% off)", "Access to all premium content", "Monthly bonus credits", "Exclusive community access"],
    durationMonths: 1,
    isActive: true
  }
];

async function createMissingCollections() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    console.log("Connection successful!");

    // Get the database
    const db = client.db("soulseer");
    console.log("Using database: soulseer");

    // Get list of existing collections
    const existingCollections = await db.listCollections().toArray();
    const existingCollectionNames = existingCollections.map(c => c.name);
    
    console.log("Existing collections:", existingCollectionNames.length > 0 ? existingCollectionNames.join(", ") : "None");
    
    // Create collections and add indexes
    let collectionsCreated = 0;
    for (const collectionName of COLLECTIONS_TO_CREATE) {
      // Check if collection already exists
      if (!existingCollectionNames.includes(collectionName)) {
        console.log(`Creating collection: ${collectionName}`);
        await db.createCollection(collectionName);
        collectionsCreated++;
      } else {
        console.log(`Collection already exists: ${collectionName}`);
      }
      
      // Create indexes for the collection
      if (INDEXES[collectionName]) {
        const collection = db.collection(collectionName);
        for (const index of INDEXES[collectionName]) {
          try {
            console.log(`Creating index on ${collectionName}: ${JSON.stringify(index.key)}`);
            await collection.createIndex(index.key, { unique: index.unique || false });
          } catch (indexError) {
            console.warn(`Error creating index on ${collectionName}: ${indexError.message}`);
          }
        }
      }
    }

    // Seed forum categories if needed
    const forumCategoriesCollection = db.collection('forum_categories');
    const categoryCount = await forumCategoriesCollection.countDocuments();
    if (categoryCount === 0) {
      console.log("Seeding forum categories...");
      for (const category of FORUM_CATEGORIES) {
        await forumCategoriesCollection.insertOne({
          ...category,
          moderatorIds: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log(`Created ${FORUM_CATEGORIES.length} forum categories`);
    }

    // Seed virtual gifts if needed
    const virtualGiftsCollection = db.collection('virtual_gifts');
    const giftsCount = await virtualGiftsCollection.countDocuments();
    if (giftsCount === 0) {
      console.log("Seeding virtual gifts...");
      for (const gift of VIRTUAL_GIFTS) {
        await virtualGiftsCollection.insertOne({
          ...gift,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log(`Created ${VIRTUAL_GIFTS.length} virtual gifts`);
    }

    // Seed subscription plans if needed
    const plansCollection = db.collection('plans');
    const plansCount = await plansCollection.countDocuments();
    if (plansCount === 0) {
      console.log("Seeding subscription plans...");
      for (const plan of SUBSCRIPTION_PLANS) {
        await plansCollection.insertOne({
          ...plan,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log(`Created ${SUBSCRIPTION_PLANS.length} subscription plans`);
    }

    console.log(`\nMongoDB setup complete!`);
    console.log(`Created ${collectionsCreated} new collections`);
    console.log(`All required indexes have been created`);
    
    // Display schema summary
    console.log("\nSchema Summary:");
    for (const collectionName in SCHEMAS) {
      const fields = Object.keys(SCHEMAS[collectionName]).length;
      console.log(`- ${collectionName}: ${fields} fields defined`);
    }
    
  } catch (error) {
    console.error("Error creating MongoDB collections:");
    console.error(error);
  } finally {
    await client.close();
    console.log("\nMongoDB connection closed");
  }
}

// Run the creation process
createMissingCollections().catch(console.error);