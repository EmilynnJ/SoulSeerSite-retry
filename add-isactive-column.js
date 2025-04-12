// Script to add isActive column to products table
import { pool } from './server/db.js';
import dotenv from 'dotenv';

// Use CommonJS require as a fallback if ESM import fails
let dbPool;
try {
  dbPool = pool;
} catch (e) {
  // Use require instead
  const { pool: cjsPool } = require('./server/db.js');
  dbPool = cjsPool;
}

dotenv.config();

async function addIsActiveColumn() {
  const client = await dbPool.connect();
  try {
    console.log('Adding isActive column to products table...');
    
    // Check if column already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'is_active'
    `);
    
    if (checkResult.rows.length === 0) {
      // Column doesn't exist, add it
      await client.query(`
        ALTER TABLE products 
        ADD COLUMN is_active boolean DEFAULT true
      `);
      console.log('isActive column added successfully!');
    } else {
      console.log('isActive column already exists, skipping.');
    }
  } catch (error) {
    console.error('Error adding isActive column:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await addIsActiveColumn();
    console.log('Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();