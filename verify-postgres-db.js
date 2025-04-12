/**
 * Script to verify PostgreSQL database for SoulSeer
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verifyDatabase() {
  let client;
  try {
    client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Check users
    const usersResult = await client.query('SELECT id, username, email, role, pricing_video, pricing_voice, pricing_chat FROM users');
    console.log('Users in database:');
    usersResult.rows.forEach(user => {
      console.log(`- ${user.username} (${user.email}): ${user.role}, Pricing: $${(user.pricing_video || 0)/100}/min video, $${(user.pricing_voice || 0)/100}/min voice, $${(user.pricing_chat || 0)/100}/min chat`);
    });
    
    // Check forum categories
    const categoriesResult = await client.query('SELECT id, name, slug FROM forum_categories');
    console.log('\nForum Categories:');
    categoriesResult.rows.forEach(category => {
      console.log(`- ${category.name} (${category.slug})`);
    });
    
    // Check reader balances
    const balancesResult = await client.query('SELECT rb.reader_id, u.username, rb.available_balance, rb.pending_balance, rb.lifetime_earnings FROM reader_balances rb JOIN users u ON rb.reader_id = u.id');
    console.log('\nReader Balances:');
    balancesResult.rows.forEach(balance => {
      console.log(`- ${balance.username}: Available: $${(balance.available_balance || 0)/100}, Pending: $${(balance.pending_balance || 0)/100}, Lifetime: $${(balance.lifetime_earnings || 0)/100}`);
    });
    
  } catch (error) {
    console.error('Error verifying database:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

verifyDatabase().catch(console.error);