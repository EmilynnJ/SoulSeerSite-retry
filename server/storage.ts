/**
 * Storage interface and implementation for SoulSeer
 * PostgreSQL database via Drizzle ORM
 */

import { 
  users, type User, type NewUser, type User as UserUpdate, 
  readings, type Reading, type NewReading, 
  products, type Product, type NewProduct, 
  orders, type Order, type NewOrder, 
  orderItems, type OrderItem, type NewOrderItem, 
  livestreams, type Livestream, type NewLivestream, type Livestream as LivestreamUpdate, 
  forumThreads, type ForumThread, type NewForumThread,
  forumPosts, type ForumPost, type NewForumPost,
  forumCategories, type ForumCategory, type NewForumCategory,
  gifts, type Gift, type NewGift,
  sessions, type Session, type NewSession,
  clientBalances, type ClientBalance, type NewClientBalance,
  readerBalances, type ReaderBalance, type NewReaderBalance,
  conversations, type Conversation, type NewConversation,
  messages, type Message, type NewMessage,
  readerAvailability, type ReaderAvailability, type NewReaderAvailability,
  appointments, type Appointment, type NewAppointment
} from "../shared/schema";

import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and, or, desc, isNull, asc, sql, count } from "drizzle-orm";
import { log } from './server-only';

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPgSimple(session);

// Define SessionStore type - using any to bypass strict typing issues with session stores
type SessionStore = any;

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: NewUser): Promise<User>;
  updateUser(id: number, user: UserUpdate): Promise<User | undefined>;
  getReaders(): Promise<User[]>;
  getOnlineReaders(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  
  // Readings
  createReading(reading: NewReading): Promise<Reading>;
  getReading(id: number): Promise<Reading | undefined>;
  getReadings(): Promise<Reading[]>;
  getReadingsByClient(clientId: number): Promise<Reading[]>;
  getReadingsByReader(readerId: number): Promise<Reading[]>;
  updateReading(id: number, reading: Partial<NewReading>): Promise<Reading | undefined>;
  
  // Products
  createProduct(product: NewProduct): Promise<Product>;
  getProduct(id: number): Promise<Product | undefined>;
  getProducts(): Promise<Product[]>;
  getFeaturedProducts(): Promise<Product[]>;
  updateProduct(id: number, product: Partial<NewProduct>): Promise<Product | undefined>;
  
  // Orders
  createOrder(order: NewOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByUser(userId: number): Promise<Order[]>;
  updateOrder(id: number, order: Partial<NewOrder>): Promise<Order | undefined>;
  
  // Order Items
  createOrderItem(orderItem: NewOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  
  // Livestreams
  createLivestream(livestream: NewLivestream): Promise<Livestream>;
  getLivestream(id: number): Promise<Livestream | undefined>;
  getLivestreams(): Promise<Livestream[]>;
  getLivestreamsByUser(userId: number): Promise<Livestream[]>;
  updateLivestream(id: number, livestream: Partial<NewLivestream>): Promise<Livestream | undefined>;
  
  // Forum Threads
  createForumThread(forumThread: NewForumThread): Promise<ForumThread>;
  getForumThread(id: number): Promise<ForumThread | undefined>;
  getForumThreads(): Promise<ForumThread[]>;
  getForumThreadsByCategory(categoryId: number): Promise<ForumThread[]>;
  updateForumThread(id: number, forumThread: Partial<NewForumThread>): Promise<ForumThread | undefined>;
  
  // Forum Posts
  createForumPost(forumPost: NewForumPost): Promise<ForumPost>;
  getForumPost(id: number): Promise<ForumPost | undefined>;
  getForumPostsByThread(threadId: number): Promise<ForumPost[]>;
  updateForumPost(id: number, forumPost: Partial<NewForumPost>): Promise<ForumPost | undefined>;
  
  // Forum Categories
  createForumCategory(forumCategory: NewForumCategory): Promise<ForumCategory>;
  getForumCategories(): Promise<ForumCategory[]>;
  getForumCategory(id: number): Promise<ForumCategory | undefined>;
  updateForumCategory(id: number, forumCategory: Partial<NewForumCategory>): Promise<ForumCategory | undefined>;
  
  // Forum Methods (Delete operations)
  deleteForumThread(id: number): Promise<void>;
  deleteForumPost(id: number): Promise<void>;
  deleteForumPostsByThread(threadId: number): Promise<void>;
  
  // Sessions (Pay-per-minute)
  createSession(session: NewSession): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  getSessionsByClient(clientId: number): Promise<Session[]>;
  getSessionsByReader(readerId: number): Promise<Session[]>;
  updateSession(id: number, sessionData: Partial<NewSession>): Promise<Session | undefined>;
  
  // Client Balances
  getClientBalance(clientId: number): Promise<ClientBalance | undefined>;
  updateClientBalance(clientId: number, amount: number): Promise<ClientBalance | undefined>;
  
  // Reader Balances
  getReaderBalance(readerId: number): Promise<ReaderBalance | undefined>;
  updateReaderBalance(readerId: number, availableAmount: number, pendingAmount: number): Promise<ReaderBalance | undefined>;
  
  // Gifts for livestreams
  createGift(gift: NewGift): Promise<Gift>;
  getGiftsByLivestream(livestreamId: number): Promise<Gift[]>;
  getGiftsBySender(senderId: number): Promise<Gift[]>;
  getGiftsByRecipient(recipientId: number): Promise<Gift[]>;
  getUnprocessedGifts(): Promise<Gift[]>;
  markGiftAsProcessed(id: number): Promise<Gift | undefined>;
  
  // Messaging - Conversations
  createConversation(conversation: NewConversation): Promise<Conversation>;
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationByUsers(user1Id: number, user2Id: number): Promise<Conversation | undefined>;
  getConversationsByUser(userId: number): Promise<Conversation[]>;
  updateConversation(id: number, conversation: Partial<NewConversation>): Promise<Conversation | undefined>;
  
  // Messaging - Messages
  createMessage(message: NewMessage): Promise<Message>;
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByConversation(conversationId: number): Promise<Message[]>;
  getUnreadMessageCount(userId: number): Promise<number>;
  markMessageAsRead(messageId: number): Promise<Message | undefined>;
  
  // Session store for authentication
  sessionStore: SessionStore;
  
  // Reader Availability
  createReaderAvailability(availability: NewReaderAvailability): Promise<ReaderAvailability>;
  getReaderAvailability(readerId: number): Promise<ReaderAvailability[]>;
  updateReaderAvailability(id: number, availability: Partial<NewReaderAvailability>): Promise<ReaderAvailability | undefined>;
  deleteReaderAvailability(id: number): Promise<void>;
  
  // Appointments
  createAppointment(appointment: NewAppointment): Promise<Appointment>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  getAppointmentsByReader(readerId: number): Promise<Appointment[]>;
  getAppointmentsByClient(clientId: number): Promise<Appointment[]>;
  updateAppointment(id: number, appointment: Partial<NewAppointment>): Promise<Appointment | undefined>;
  cancelAppointment(id: number): Promise<Appointment | undefined>;
}

/**
 * PostgreSQL/Drizzle implementation of IStorage
 */
export class PostgresStorage implements IStorage {
  sessionStore: SessionStore;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'user_sessions', // Separate from our sessions table which is for readings
      createTableIfMissing: false // Changed to false to prevent conflicts with existing session table
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  
  async createUser(userData: NewUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  
  async updateUser(id: number, userData: UserUpdate): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  async getReaders(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, 'reader'));
  }
  
  async getOnlineReaders(): Promise<User[]> {
    return await db.select().from(users)
      .where(and(
        eq(users.role, 'reader'),
        eq(users.isOnline, true)
      ));
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  // Reading methods
  async createReading(readingData: NewReading): Promise<Reading> {
    const [reading] = await db.insert(readings).values(readingData).returning();
    return reading;
  }
  
  async getReading(id: number): Promise<Reading | undefined> {
    const result = await db.select().from(readings).where(eq(readings.id, id));
    return result[0];
  }
  
  async getReadings(): Promise<Reading[]> {
    return await db.select().from(readings);
  }
  
  async getReadingsByClient(clientId: number): Promise<Reading[]> {
    return await db.select().from(readings).where(eq(readings.clientId, clientId));
  }
  
  async getReadingsByReader(readerId: number): Promise<Reading[]> {
    return await db.select().from(readings).where(eq(readings.readerId, readerId));
  }
  
  async updateReading(id: number, readingData: Partial<NewReading>): Promise<Reading | undefined> {
    const [reading] = await db.update(readings)
      .set(readingData)
      .where(eq(readings.id, id))
      .returning();
    return reading;
  }
  
  // Product methods
  async createProduct(productData: NewProduct): Promise<Product> {
    const [product] = await db.insert(products).values(productData).returning();
    return product;
  }
  
  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }
  
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }
  
  async getFeaturedProducts(): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.isFeatured, true));
  }
  
  async updateProduct(id: number, productData: Partial<NewProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products)
      .set(productData)
      .where(eq(products.id, id))
      .returning();
    return product;
  }
  
  // Order methods
  async createOrder(orderData: NewOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(orderData).returning();
    return order;
  }
  
  async getOrder(id: number): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }
  
  async getOrdersByUser(userId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId));
  }
  
  async updateOrder(id: number, orderData: Partial<NewOrder>): Promise<Order | undefined> {
    const [order] = await db.update(orders)
      .set(orderData)
      .where(eq(orders.id, id))
      .returning();
    return order;
  }
  
  // Order items methods
  async createOrderItem(orderItemData: NewOrderItem): Promise<OrderItem> {
    const [orderItem] = await db.insert(orderItems).values(orderItemData).returning();
    return orderItem;
  }
  
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }
  
  // Livestream methods
  async createLivestream(livestreamData: NewLivestream): Promise<Livestream> {
    const [livestream] = await db.insert(livestreams).values(livestreamData).returning();
    return livestream;
  }
  
  async getLivestream(id: number): Promise<Livestream | undefined> {
    const result = await db.select().from(livestreams).where(eq(livestreams.id, id));
    return result[0];
  }
  
  async getLivestreams(): Promise<Livestream[]> {
    return await db.select().from(livestreams);
  }
  
  async getLivestreamsByUser(userId: number): Promise<Livestream[]> {
    return await db.select().from(livestreams).where(eq(livestreams.hostId, userId));
  }
  
  async updateLivestream(id: number, livestreamData: Partial<NewLivestream>): Promise<Livestream | undefined> {
    const [livestream] = await db.update(livestreams)
      .set(livestreamData)
      .where(eq(livestreams.id, id))
      .returning();
    return livestream;
  }
  
  // Forum Thread methods
  async createForumThread(threadData: NewForumThread): Promise<ForumThread> {
    const [thread] = await db.insert(forumThreads).values(threadData).returning();
    return thread;
  }
  
  async getForumThread(id: number): Promise<ForumThread | undefined> {
    const result = await db.select().from(forumThreads).where(eq(forumThreads.id, id));
    return result[0];
  }
  
  async getForumThreads(): Promise<ForumThread[]> {
    return await db.select().from(forumThreads);
  }
  
  async getForumThreadsByCategory(categoryId: number): Promise<ForumThread[]> {
    return await db.select().from(forumThreads).where(eq(forumThreads.categoryId, categoryId));
  }
  
  async updateForumThread(id: number, threadData: Partial<NewForumThread>): Promise<ForumThread | undefined> {
    const [thread] = await db.update(forumThreads)
      .set(threadData)
      .where(eq(forumThreads.id, id))
      .returning();
    return thread;
  }
  
  // Forum Post methods
  async createForumPost(postData: NewForumPost): Promise<ForumPost> {
    const [post] = await db.insert(forumPosts).values(postData).returning();
    return post;
  }
  
  async getForumPost(id: number): Promise<ForumPost | undefined> {
    const result = await db.select().from(forumPosts).where(eq(forumPosts.id, id));
    return result[0];
  }
  
  async getForumPostsByThread(threadId: number): Promise<ForumPost[]> {
    return await db.select().from(forumPosts).where(eq(forumPosts.threadId, threadId));
  }
  
  async updateForumPost(id: number, postData: Partial<NewForumPost>): Promise<ForumPost | undefined> {
    const [post] = await db.update(forumPosts)
      .set(postData)
      .where(eq(forumPosts.id, id))
      .returning();
    return post;
  }
  
  // Forum Category methods
  async createForumCategory(categoryData: NewForumCategory): Promise<ForumCategory> {
    const [category] = await db.insert(forumCategories).values(categoryData).returning();
    return category;
  }
  
  async getForumCategories(): Promise<ForumCategory[]> {
    return await db.select().from(forumCategories);
  }
  
  async getForumCategory(id: number): Promise<ForumCategory | undefined> {
    const result = await db.select().from(forumCategories).where(eq(forumCategories.id, id));
    return result[0];
  }
  
  async updateForumCategory(id: number, categoryData: Partial<NewForumCategory>): Promise<ForumCategory | undefined> {
    const [category] = await db.update(forumCategories)
      .set(categoryData)
      .where(eq(forumCategories.id, id))
      .returning();
    return category;
  }
  
  // Forum delete operations
  async deleteForumThread(id: number): Promise<void> {
    await db.delete(forumThreads).where(eq(forumThreads.id, id));
  }
  
  async deleteForumPost(id: number): Promise<void> {
    await db.delete(forumPosts).where(eq(forumPosts.id, id));
  }
  
  async deleteForumPostsByThread(threadId: number): Promise<void> {
    await db.delete(forumPosts).where(eq(forumPosts.threadId, threadId));
  }
  
  // Session methods (for pay-per-minute readings)
  async createSession(sessionData: NewSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(sessionData).returning();
    return session;
  }
  
  async getSession(id: number): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, id));
    return result[0];
  }
  
  async getSessionsByClient(clientId: number): Promise<Session[]> {
    return await db.select().from(sessions).where(eq(sessions.clientId, clientId));
  }
  
  async getSessionsByReader(readerId: number): Promise<Session[]> {
    return await db.select().from(sessions).where(eq(sessions.readerId, readerId));
  }
  
  async updateSession(id: number, sessionData: Partial<NewSession>): Promise<Session | undefined> {
    const [session] = await db.update(sessions)
      .set(sessionData)
      .where(eq(sessions.id, id))
      .returning();
    return session;
  }
  
  // Client Balance methods
  async getClientBalance(clientId: number): Promise<ClientBalance | undefined> {
    const result = await db.select().from(clientBalances).where(eq(clientBalances.clientId, clientId));
    return result[0];
  }
  
  async updateClientBalance(clientId: number, amount: number): Promise<ClientBalance | undefined> {
    // First, check if balance exists
    const existingBalance = await this.getClientBalance(clientId);
    
    if (existingBalance) {
      // Update existing balance
      const currentBalance = existingBalance.balance || 0;
      const [balance] = await db.update(clientBalances)
        .set({ 
          balance: currentBalance + amount,
          lastUpdated: new Date()
        })
        .where(eq(clientBalances.clientId, clientId))
        .returning();
      return balance;
    } else {
      // Create new balance
      const [balance] = await db.insert(clientBalances)
        .values({
          clientId,
          balance: amount,
          currency: 'usd'
        })
        .returning();
      return balance;
    }
  }
  
  // Reader Balance methods
  async getReaderBalance(readerId: number): Promise<ReaderBalance | undefined> {
    const result = await db.select().from(readerBalances).where(eq(readerBalances.readerId, readerId));
    return result[0];
  }
  
  async updateReaderBalance(readerId: number, availableAmount: number, pendingAmount: number): Promise<ReaderBalance | undefined> {
    // First, check if balance exists
    const existingBalance = await this.getReaderBalance(readerId);
    
    if (existingBalance) {
      // Update existing balance
      const currentAvailable = existingBalance.availableBalance || 0;
      const currentPending = existingBalance.pendingBalance || 0;
      const currentLifetime = existingBalance.lifetimeEarnings || 0;
      
      const [balance] = await db.update(readerBalances)
        .set({ 
          availableBalance: currentAvailable + availableAmount,
          pendingBalance: currentPending + pendingAmount,
          lifetimeEarnings: currentLifetime + availableAmount + pendingAmount,
          updatedAt: new Date()
        })
        .where(eq(readerBalances.readerId, readerId))
        .returning();
      return balance;
    } else {
      // Create new balance
      const [balance] = await db.insert(readerBalances)
        .values({
          readerId,
          availableBalance: availableAmount,
          pendingBalance: pendingAmount, 
          lifetimeEarnings: availableAmount + pendingAmount,
          currency: 'usd'
        })
        .returning();
      return balance;
    }
  }
  
  // Gift methods
  async createGift(giftData: NewGift): Promise<Gift> {
    const [gift] = await db.insert(gifts).values(giftData).returning();
    return gift;
  }
  
  async getGiftsByLivestream(livestreamId: number): Promise<Gift[]> {
    return await db.select().from(gifts).where(eq(gifts.livestreamId, livestreamId));
  }
  
  async getGiftsBySender(senderId: number): Promise<Gift[]> {
    return await db.select().from(gifts).where(eq(gifts.senderId, senderId));
  }
  
  async getGiftsByRecipient(recipientId: number): Promise<Gift[]> {
    return await db.select().from(gifts).where(eq(gifts.recipientId, recipientId));
  }
  
  async getUnprocessedGifts(): Promise<Gift[]> {
    return await db.select().from(gifts).where(eq(gifts.processed, false));
  }
  
  async markGiftAsProcessed(id: number): Promise<Gift | undefined> {
    const [gift] = await db.update(gifts)
      .set({ 
        processed: true,
        processedAt: new Date()
      })
      .where(eq(gifts.id, id))
      .returning();
    return gift;
  }

  // Conversation methods
  async createConversation(conversationData: NewConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(conversationData).returning();
    return conversation;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async getConversationByUsers(user1Id: number, user2Id: number): Promise<Conversation | undefined> {
    // Since a conversation can be stored as (user1, user2) or (user2, user1), we need to check both cases
    const result = await db.select().from(conversations).where(
      or(
        and(eq(conversations.user1Id, user1Id), eq(conversations.user2Id, user2Id)),
        and(eq(conversations.user1Id, user2Id), eq(conversations.user2Id, user1Id))
      )
    );
    return result[0];
  }

  async getConversationsByUser(userId: number): Promise<Conversation[]> {
    // Fetch all conversations where the user is either user1 or user2
    return await db.select().from(conversations).where(
      or(
        eq(conversations.user1Id, userId),
        eq(conversations.user2Id, userId)
      )
    ).orderBy(desc(conversations.lastMessageAt));
  }

  async updateConversation(id: number, conversationData: Partial<NewConversation>): Promise<Conversation | undefined> {
    const [conversation] = await db.update(conversations)
      .set(conversationData)
      .where(eq(conversations.id, id))
      .returning();
    return conversation;
  }

  // Message methods
  async createMessage(messageData: NewMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(messageData).returning();
    
    // Update the conversation's lastMessageAt timestamp
    await this.updateConversation(messageData.conversationId, {
      lastMessageAt: new Date()
    } as any);
    
    return message;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const result = await db.select().from(messages).where(eq(messages.id, id));
    return result[0];
  }

  async getMessagesByConversation(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const result = await db.select({ count: count() })
      .from(messages)
      .where(
        and(
          eq(messages.recipientId, userId),
          eq(messages.isRead, false)
        )
      );
    
    return result[0]?.count || 0;
  }

  async markMessageAsRead(messageId: number): Promise<Message | undefined> {
    const [message] = await db.update(messages)
      .set({ 
        isRead: true,
        readAt: new Date()
      })
      .where(eq(messages.id, messageId))
      .returning();
    return message;
  }
  
  // Reader Availability methods
  async createReaderAvailability(availabilityData: NewReaderAvailability): Promise<ReaderAvailability> {
    const [availability] = await db.insert(readerAvailability).values(availabilityData).returning();
    return availability;
  }
  
  async getReaderAvailability(readerId: number): Promise<ReaderAvailability[]> {
    return await db.select().from(readerAvailability).where(eq(readerAvailability.readerId, readerId));
  }
  
  async updateReaderAvailability(id: number, availabilityData: Partial<NewReaderAvailability>): Promise<ReaderAvailability | undefined> {
    const [availability] = await db.update(readerAvailability)
      .set(availabilityData)
      .where(eq(readerAvailability.id, id))
      .returning();
    return availability;
  }
  
  async deleteReaderAvailability(id: number): Promise<void> {
    await db.delete(readerAvailability).where(eq(readerAvailability.id, id));
  }
  
  // Appointment methods
  async createAppointment(appointmentData: NewAppointment): Promise<Appointment> {
    const [appointment] = await db.insert(appointments).values(appointmentData).returning();
    return appointment;
  }
  
  async getAppointment(id: number): Promise<Appointment | undefined> {
    const result = await db.select().from(appointments).where(eq(appointments.id, id));
    return result[0];
  }
  
  async getAppointmentsByReader(readerId: number): Promise<Appointment[]> {
    return await db.select().from(appointments).where(eq(appointments.readerId, readerId));
  }
  
  async getAppointmentsByClient(clientId: number): Promise<Appointment[]> {
    return await db.select().from(appointments).where(eq(appointments.clientId, clientId));
  }
  
  async updateAppointment(id: number, appointmentData: Partial<NewAppointment>): Promise<Appointment | undefined> {
    const [appointment] = await db.update(appointments)
      .set(appointmentData)
      .where(eq(appointments.id, id))
      .returning();
    return appointment;
  }
  
  async cancelAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db.update(appointments)
      .set({ status: 'canceled' })
      .where(eq(appointments.id, id))
      .returning();
    return appointment;
  }
}

// Initialize storage
export const storage: IStorage = new PostgresStorage();