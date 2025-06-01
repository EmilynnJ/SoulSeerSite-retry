import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Create Neon connection
const sql = neon(process.env.DATABASE_URL);

// Initialize Drizzle with the neon connection and schema
export const db = drizzle(sql, { schema });