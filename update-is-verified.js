// CommonJS script to fix is_verified column
const { Pool } = require('pg');
require('dotenv').config();

// Connect to PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixIsVerifiedColumn() {
  console.log('Starting script to fix is_verified column...');
  const client = await pool.connect();
  
  try {
    // First, make sure the column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'is_verified';
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('is_verified column does not exist, creating it...');
      await client.query(`ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;`);
      console.log('is_verified column added successfully.');
    } else {
      console.log('is_verified column already exists.');
    }
    
    // Update all users to have is_verified set to TRUE by default
    await client.query(`UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;`);
    console.log('Set all users is_verified to TRUE');
    
    const results = await client.query(`SELECT id, username, email, is_verified FROM users;`);
    console.log('Current users:');
    console.table(results.rows);
    
    console.log('Successfully completed fixing the is_verified column!');
  } catch (error) {
    console.error('Error updating is_verified column:', error);
  } finally {
    client.release();
  }
}

fixIsVerifiedColumn()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });