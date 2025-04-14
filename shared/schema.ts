/**
 * Database schema for SoulSeer
 * Using Drizzle ORM
 */

import { pgTable, serial, varchar, text, boolean, decimal, integer, timestamp, jsonb, date, time } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  role: varchar('role', { length: 50 }).notNull().default('user'),
  profileImage: varchar('profile_image', { length: 255 }),
  bio: text('bio'),
  isVerified: boolean('is_verified').default(false),
  isOnline: boolean('is_online').default(false),
  isAvailable: boolean('is_available').default(false),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeConnectId: varchar('stripe_connect_id', { length: 255 }),
  specialties: text('specialties').array(),
  yearsOfExperience: integer('years_of_experience'),
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0'),
  reviewCount: integer('review_count').default(0),
  pricingVideo: integer('pricing_video').default(0),
  pricingVoice: integer('pricing_voice').default(0),
  pricingChat: integer('pricing_chat').default(0),
  minimumSessionLength: integer('minimum_session_length').default(5),
  completedReadings: integer('completed_readings').default(0),
  totalReadingMinutes: integer('total_reading_minutes').default(0),
  accountBalance: integer('account_balance').default(0),
  lastActive: timestamp('last_active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Create the insert schema for user creation
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, updatedAt: true });

// Define the types
export type User = typeof users.$inferSelect;
export type NewUser = z.infer<typeof insertUserSchema>;

// Readings table
export const readings = pgTable('readings', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => users.id),
  readerId: integer('reader_id').notNull().references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('requested'),
  notes: text('notes'),
  rating: integer('rating'),
  review: text('review'),
  duration: integer('duration').default(0),
  totalAmount: integer('total_amount').default(0),
  roomId: varchar('room_id', { length: 255 }),
  scheduledAt: timestamp('scheduled_at'),
  completedAt: timestamp('completed_at'),
  clientNotes: text('client_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertReadingSchema = createInsertSchema(readings)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type Reading = typeof readings.$inferSelect;
export type NewReading = z.infer<typeof insertReadingSchema>;

// Payments table
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  readingId: integer('reading_id').references(() => readings.id),
  userId: integer('user_id').notNull().references(() => users.id),
  readerId: integer('reader_id').references(() => users.id),
  amount: integer('amount').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  type: varchar('type', { length: 50 }).notNull(),
  stripePaymentId: varchar('stripe_payment_id', { length: 255 }),
  readerShare: integer('reader_share'),
  platformFee: integer('platform_fee'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertPaymentSchema = createInsertSchema(payments)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type Payment = typeof payments.$inferSelect;
export type NewPayment = z.infer<typeof insertPaymentSchema>;

// Products table
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  imageUrl: varchar('image_url', { length: 255 }),
  category: varchar('category', { length: 100 }).notNull(),
  inventory: integer('inventory').default(0),
  isFeatured: boolean('is_featured').default(false),
  isActive: boolean('is_active').default(true),
  sellerId: integer('seller_id').references(() => users.id),
  stripeProductId: varchar('stripe_product_id', { length: 255 }),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertProductSchema = createInsertSchema(products)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type Product = typeof products.$inferSelect;
export type NewProduct = z.infer<typeof insertProductSchema>;

// Livestreams table
export const livestreams = pgTable('livestreams', {
  id: serial('id').primaryKey(),
  hostId: integer('host_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull().default('scheduled'),
  scheduledAt: timestamp('scheduled_at'),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  thumbnailUrl: varchar('thumbnail_url', { length: 255 }),
  viewCount: integer('view_count').default(0),
  roomId: varchar('room_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertLivestreamSchema = createInsertSchema(livestreams)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type Livestream = typeof livestreams.$inferSelect;
export type NewLivestream = z.infer<typeof insertLivestreamSchema>;

// Orders table
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  totalAmount: integer('total_amount').notNull(),
  stripeSessionId: varchar('stripe_session_id', { length: 255 }),
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  shippingAddress: jsonb('shipping_address'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type Order = typeof orders.$inferSelect;
export type NewOrder = z.infer<typeof insertOrderSchema>;

// Order items table
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  price: integer('price').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

export const insertOrderItemSchema = createInsertSchema(orderItems)
  .omit({ id: true, createdAt: true });

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = z.infer<typeof insertOrderItemSchema>;

// Client balances table
export const clientBalances = pgTable('client_balances', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => users.id),
  balance: integer('balance').default(0),
  currency: varchar('currency', { length: 10 }).default('usd'),
  lastUpdated: timestamp('last_updated').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertClientBalanceSchema = createInsertSchema(clientBalances)
  .omit({ id: true, createdAt: true, updatedAt: true, lastUpdated: true });

export type ClientBalance = typeof clientBalances.$inferSelect;
export type NewClientBalance = z.infer<typeof insertClientBalanceSchema>;

// Reader balances table
export const readerBalances = pgTable('reader_balances', {
  id: serial('id').primaryKey(),
  readerId: integer('reader_id').notNull().references(() => users.id),
  availableBalance: integer('available_balance').default(0),
  pendingBalance: integer('pending_balance').default(0),
  lifetimeEarnings: integer('lifetime_earnings').default(0),
  lastPayout: timestamp('last_payout'),
  nextScheduledPayout: timestamp('next_scheduled_payout'),
  payoutMethod: varchar('payout_method', { length: 50 }),
  payoutDetails: jsonb('payout_details'),
  currency: varchar('currency', { length: 10 }).default('usd'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertReaderBalanceSchema = createInsertSchema(readerBalances)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type ReaderBalance = typeof readerBalances.$inferSelect;
export type NewReaderBalance = z.infer<typeof insertReaderBalanceSchema>;

// Sessions table
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => users.id),
  readerId: integer('reader_id').notNull().references(() => users.id),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('created'),
  roomId: varchar('room_id', { length: 255 }).notNull(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  duration: integer('duration').default(0),
  amountPerMinute: integer('amount_per_minute').notNull(),
  totalAmount: integer('total_amount').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertSessionSchema = createInsertSchema(sessions)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type Session = typeof sessions.$inferSelect;
export type NewSession = z.infer<typeof insertSessionSchema>;

// Gifts table
export const gifts = pgTable('gifts', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').notNull().references(() => users.id),
  recipientId: integer('recipient_id').notNull().references(() => users.id),
  livestreamId: integer('livestream_id').references(() => livestreams.id),
  amount: integer('amount').notNull(),
  giftType: varchar('gift_type', { length: 50 }).notNull(),
  message: text('message'),
  readerAmount: integer('reader_amount').notNull(),
  platformAmount: integer('platform_amount').notNull(),
  processed: boolean('processed').default(false),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow()
});

export const insertGiftSchema = createInsertSchema(gifts)
  .omit({ id: true, createdAt: true });

export type Gift = typeof gifts.$inferSelect;
export type NewGift = z.infer<typeof insertGiftSchema>;

// Forum categories table
export const forumCategories = pgTable('forum_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow()
});

export const insertForumCategorySchema = createInsertSchema(forumCategories)
  .omit({ id: true, createdAt: true });

export type ForumCategory = typeof forumCategories.$inferSelect;
export type NewForumCategory = z.infer<typeof insertForumCategorySchema>;

// Forum threads table
export const forumThreads = pgTable('forum_threads', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').notNull().references(() => forumCategories.id),
  userId: integer('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  content: text('content').notNull(),
  isPinned: boolean('is_pinned').default(false),
  isLocked: boolean('is_locked').default(false),
  views: integer('views').default(0),
  lastActivity: timestamp('last_activity').defaultNow(),
  createdAt: timestamp('created_at').defaultNow()
});

export const insertForumThreadSchema = createInsertSchema(forumThreads)
  .omit({ id: true, createdAt: true, lastActivity: true });

export type ForumThread = typeof forumThreads.$inferSelect;
export type NewForumThread = z.infer<typeof insertForumThreadSchema>;

// Forum posts table
export const forumPosts = pgTable('forum_posts', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').notNull().references(() => forumThreads.id),
  userId: integer('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertForumPostSchema = createInsertSchema(forumPosts)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type ForumPost = typeof forumPosts.$inferSelect;
export type NewForumPost = z.infer<typeof insertForumPostSchema>;

// Conversations table (for private messaging)
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  user1Id: integer('user1_id').notNull().references(() => users.id),
  user2Id: integer('user2_id').notNull().references(() => users.id),
  lastMessageAt: timestamp('last_message_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow()
});

export const insertConversationSchema = createInsertSchema(conversations)
  .omit({ id: true, lastMessageAt: true, createdAt: true });

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = z.infer<typeof insertConversationSchema>;

// Messages table
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id),
  senderId: integer('sender_id').notNull().references(() => users.id),
  recipientId: integer('recipient_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow()
});

export const insertMessageSchema = createInsertSchema(messages)
  .omit({ id: true, isRead: true, readAt: true, createdAt: true });

export type Message = typeof messages.$inferSelect;
export type NewMessage = z.infer<typeof insertMessageSchema>;

// Reader Availability table
export const readerAvailability = pgTable('reader_availability', {
  id: serial('id').primaryKey(),
  readerId: integer('reader_id').notNull().references(() => users.id),
  day: varchar('day', { length: 20 }).notNull(),
  startTime: varchar('start_time', { length: 10 }).notNull(),
  endTime: varchar('end_time', { length: 10 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertReaderAvailabilitySchema = createInsertSchema(readerAvailability)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type ReaderAvailability = typeof readerAvailability.$inferSelect;
export type NewReaderAvailability = z.infer<typeof insertReaderAvailabilitySchema>;

// Types for availability management in the UI
export interface TimeSlot {
  startTime: string;
  endTime: string;
}

export interface DayAvailability {
  day: string;
  slots: TimeSlot[];
}

export type ReaderSchedule = DayAvailability[];

// Scheduled appointments table
export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  readerId: integer('reader_id').notNull().references(() => users.id),
  clientId: integer('client_id').notNull().references(() => users.id),
  date: varchar('date', { length: 20 }).notNull(),
  time: varchar('time', { length: 10 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  duration: integer('duration').notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 20 }).notNull().default('scheduled'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const insertAppointmentSchema = createInsertSchema(appointments)
  .omit({ id: true, status: true, createdAt: true, updatedAt: true });

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = z.infer<typeof insertAppointmentSchema>;

// Input types for API endpoints
export interface AppointmentCreateInput {
  readerId: number;
  date: string;
  startTime: string;
  serviceType: string;
  duration?: number;
  notes?: string;
}