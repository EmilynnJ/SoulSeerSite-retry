/**
 * PostgreSQL database connection for SoulSeer
 * Using Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../shared/schema';
import dotenv from 'dotenv';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Create a PostgreSQL connection pool
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for some PostgreSQL providers
  }
});

// Create a Drizzle instance
export const db = drizzle(pool, { schema });

// Export for use in other server files
export default db;