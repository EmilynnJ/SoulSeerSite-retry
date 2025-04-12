/**
 * PostgreSQL Database Setup Script for SoulSeer
 * 
 * This script sets up the PostgreSQL schema for SoulSeer application
 */

const { Pool } = require('pg');
const { readFile } = require('fs').promises;
const path = require('path');

// Create a connection pool
const pool = new Pool({
  // Connection details from environment variables
  connectionString: process.env.DATABASE_URL,
});

async function setupDatabase() {
  let client;
  
  try {
    // Connect to the database
    client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Create tables
    console.log('Creating database tables...');
    
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        profile_image VARCHAR(255),
        bio TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        is_online BOOLEAN DEFAULT FALSE,
        is_available BOOLEAN DEFAULT FALSE,
        stripe_customer_id VARCHAR(255),
        stripe_connect_id VARCHAR(255),
        specialties TEXT[],
        years_of_experience INTEGER,
        rating DECIMAL(3,2) DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        pricing_video INTEGER DEFAULT 0,
        pricing_voice INTEGER DEFAULT 0,
        pricing_chat INTEGER DEFAULT 0,
        minimum_session_length INTEGER DEFAULT 5,
        completed_readings INTEGER DEFAULT 0,
        total_reading_minutes INTEGER DEFAULT 0,
        account_balance INTEGER DEFAULT 0,
        last_active TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table created/verified');
    
    // Readings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS readings (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES users(id) NOT NULL,
        reader_id INTEGER REFERENCES users(id) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'requested',
        notes TEXT,
        rating INTEGER,
        review TEXT,
        duration INTEGER DEFAULT 0,
        total_amount INTEGER DEFAULT 0,
        room_id VARCHAR(255),
        scheduled_at TIMESTAMP,
        completed_at TIMESTAMP,
        client_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Readings table created/verified');
    
    // Payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        reading_id INTEGER REFERENCES readings(id),
        user_id INTEGER REFERENCES users(id) NOT NULL,
        reader_id INTEGER REFERENCES users(id),
        amount INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        type VARCHAR(50) NOT NULL,
        stripe_payment_id VARCHAR(255),
        reader_share INTEGER,
        platform_fee INTEGER,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Payments table created/verified');
    
    // Products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        image_url VARCHAR(255),
        category VARCHAR(100) NOT NULL,
        inventory INTEGER DEFAULT 0,
        is_featured BOOLEAN DEFAULT FALSE,
        seller_id INTEGER REFERENCES users(id),
        stripe_product_id VARCHAR(255),
        stripe_price_id VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Products table created/verified');
    
    // Livestreams table
    await client.query(`
      CREATE TABLE IF NOT EXISTS livestreams (
        id SERIAL PRIMARY KEY,
        host_id INTEGER REFERENCES users(id) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
        scheduled_at TIMESTAMP,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        thumbnail_url VARCHAR(255),
        view_count INTEGER DEFAULT 0,
        room_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Livestreams table created/verified');
    
    // Orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        total_amount INTEGER NOT NULL,
        stripe_session_id VARCHAR(255),
        stripe_payment_intent_id VARCHAR(255),
        shipping_address JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Orders table created/verified');
    
    // Order items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) NOT NULL,
        product_id INTEGER REFERENCES products(id) NOT NULL,
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Order items table created/verified');
    
    // Client balances table
    await client.query(`
      CREATE TABLE IF NOT EXISTS client_balances (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES users(id) NOT NULL,
        balance INTEGER DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'usd',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Client balances table created/verified');
    
    // Reader balances table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reader_balances (
        id SERIAL PRIMARY KEY,
        reader_id INTEGER REFERENCES users(id) NOT NULL,
        available_balance INTEGER DEFAULT 0,
        pending_balance INTEGER DEFAULT 0,
        lifetime_earnings INTEGER DEFAULT 0,
        last_payout TIMESTAMP,
        next_scheduled_payout TIMESTAMP,
        payout_method VARCHAR(50),
        payout_details JSONB,
        currency VARCHAR(10) DEFAULT 'usd',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Reader balances table created/verified');
    
    // Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES users(id) NOT NULL,
        reader_id INTEGER REFERENCES users(id) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'created',
        room_id VARCHAR(255) NOT NULL,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        duration INTEGER DEFAULT 0,
        amount_per_minute INTEGER NOT NULL,
        total_amount INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Sessions table created/verified');
    
    // Gifts table for livestreams
    await client.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) NOT NULL,
        recipient_id INTEGER REFERENCES users(id) NOT NULL,
        livestream_id INTEGER REFERENCES livestreams(id),
        amount INTEGER NOT NULL,
        gift_type VARCHAR(50) NOT NULL,
        message TEXT,
        reader_amount INTEGER NOT NULL,
        platform_amount INTEGER NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Gifts table created/verified');
    
    // Forum categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Forum categories table created/verified');
    
    // Forum threads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_threads (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES forum_categories(id) NOT NULL,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_locked BOOLEAN DEFAULT FALSE,
        views INTEGER DEFAULT 0,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Forum threads table created/verified');
    
    // Forum posts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER REFERENCES forum_threads(id) NOT NULL,
        user_id INTEGER REFERENCES users(id) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Forum posts table created/verified');
    
    // Create test user accounts
    console.log('Creating test user accounts...');
    
    // Hash password function (using bcrypt would be better in a real app)
    const PASSWORD_HASH = '$2b$10$K4nTjbGj9Y0xP0HIEwdXOOeDvgOXILf6j7vkdYfvZ3lM9i1U0Acja'; // 'JayJas1423!'
    const CLIENT_PASSWORD_HASH = '$2b$10$K4nTjbGj9Y0xP0HIEwdXOOeDvgOXILf6j7vkdYfvZ3lM9i1U0Acja'; // 'Jade2014!'
    
    // Admin user
    await client.query(`
      INSERT INTO users (username, email, password, full_name, role, profile_image, bio, is_verified, is_online)
      VALUES ('emilynnj14', 'emilynnj14@gmail.com', $1, 'Admin User', 'admin', '/images/users/admin.jpg', 'System administrator', TRUE, TRUE)
      ON CONFLICT (email) DO UPDATE 
      SET username = EXCLUDED.username, 
          password = EXCLUDED.password,
          full_name = EXCLUDED.full_name,
          profile_image = EXCLUDED.profile_image,
          bio = EXCLUDED.bio;
    `, [PASSWORD_HASH]);
    console.log('Admin user created/updated');
    
    // Reader user
    const readerResult = await client.query(`
      INSERT INTO users (
        username, email, password, full_name, role, profile_image, bio, 
        is_verified, is_online, is_available, specialties, years_of_experience,
        pricing_video, pricing_voice, pricing_chat, minimum_session_length
      )
      VALUES (
        'emilynn992', 'emilynn992@gmail.com', $1, 'Psychic Reader', 
        'reader', '/images/users/reader.jpg', 'Tarot specialist with 10 years of experience in spiritual guidance.', 
        TRUE, TRUE, TRUE, ARRAY['Tarot', 'Mediumship', 'Love Readings'], 10,
        200, 150, 100, 5
      )
      ON CONFLICT (email) DO UPDATE 
      SET username = EXCLUDED.username, 
          password = EXCLUDED.password,
          full_name = EXCLUDED.full_name,
          profile_image = EXCLUDED.profile_image,
          bio = EXCLUDED.bio,
          pricing_video = EXCLUDED.pricing_video,
          pricing_voice = EXCLUDED.pricing_voice,
          pricing_chat = EXCLUDED.pricing_chat
      RETURNING id;
    `, [PASSWORD_HASH]);
    
    const readerId = readerResult.rows[0].id;
    console.log('Reader user created/updated with ID:', readerId);
    
    // Create reader balance if not exists
    await client.query(`
      INSERT INTO reader_balances (reader_id, available_balance, pending_balance, lifetime_earnings)
      VALUES ($1, 0, 0, 0)
      ON CONFLICT DO NOTHING;
    `, [readerId]);
    console.log('Reader balance created/verified');
    
    // Client user
    const clientResult = await client.query(`
      INSERT INTO users (username, email, password, full_name, role, is_verified)
      VALUES ('emily81292', 'emily81292@gmail.com', $1, 'Client User', 'client', TRUE)
      ON CONFLICT (email) DO UPDATE 
      SET username = EXCLUDED.username, 
          password = EXCLUDED.password,
          full_name = EXCLUDED.full_name
      RETURNING id;
    `, [CLIENT_PASSWORD_HASH]);
    
    const clientId = clientResult.rows[0].id;
    console.log('Client user created/updated with ID:', clientId);
    
    // Create client balance if not exists
    await client.query(`
      INSERT INTO client_balances (client_id, balance)
      VALUES ($1, 0)
      ON CONFLICT DO NOTHING;
    `, [clientId]);
    console.log('Client balance created/verified');
    
    // Create some sample forum categories
    await client.query(`
      INSERT INTO forum_categories (name, slug, description)
      VALUES 
        ('Spiritual Discussions', 'spiritual-discussions', 'Discuss all spiritual topics and experiences'),
        ('Tarot Reading', 'tarot-reading', 'Topics related to tarot card reading and interpretations'),
        ('Psychic Abilities', 'psychic-abilities', 'Discuss and learn about different psychic abilities')
      ON CONFLICT (slug) DO NOTHING;
    `);
    console.log('Sample forum categories created');
    
    console.log('Database setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
      console.log('Database connection released');
    }
    // Close the pool
    await pool.end();
    console.log('Connection pool closed');
  }
}

// Run the setup function
setupDatabase().catch(console.error);