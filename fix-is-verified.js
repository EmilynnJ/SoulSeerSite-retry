/**
 * Script to fix the is_verified column in the users table
 */
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Connect to PostgreSQL using the DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixIsVerifiedColumn() {
  const client = await pool.connect();
  
  try {
    console.log('Starting PostgreSQL fix for is_verified column...');
    
    // Check if is_verified column exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'is_verified';
    `;
    
    const columnCheck = await client.query(checkColumnQuery);
    
    if (columnCheck.rows.length === 0) {
      console.log('is_verified column does not exist, creating it...');
      await client.query(`ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;`);
      console.log('is_verified column added successfully.');
    } else {
      console.log('is_verified column already exists.');
    }
    
    // Make sure all users have is_verified set
    await client.query(`UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;`);
    console.log('Updated any NULL is_verified values to TRUE.');
    
    // Output the current data
    const results = await client.query(`SELECT id, username, email, is_verified FROM users;`);
    console.log('Current users:');
    console.table(results.rows);
    
    console.log('Fixed is_verified column successfully!');
  } catch (error) {
    console.error('Error fixing is_verified column:', error);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await fixIsVerifiedColumn();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();