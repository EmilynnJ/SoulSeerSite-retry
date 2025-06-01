import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { neon } from '@neondatabase/serverless';
import { log } from './utils.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Create Neon connection
const sql = neon(process.env.DATABASE_URL);

// Create migrations table if it doesn't exist
const createMigrationsTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
};

// Get applied migrations
const getAppliedMigrations = async (): Promise<string[]> => {
  const result = await sql`SELECT name FROM migrations ORDER BY id ASC`;
  return result.map(row => row.name);
};

// Run migrations
const runMigrations = async () => {
  try {
    log('Creating migrations table if needed...', 'database');
    await createMigrationsTable();
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    
    // Get all migration files
    const migrationsDir = join(process.cwd(), 'server', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    // Filter out already applied migrations
    const pendingMigrations = migrationFiles.filter(file => !appliedMigrations.includes(file));
    
    if (pendingMigrations.length === 0) {
      log('No pending migrations', 'database');
      return;
    }
    
    log(`Found ${pendingMigrations.length} pending migrations`, 'database');
    
    // Run each pending migration
    for (const migrationFile of pendingMigrations) {
      const migrationPath = join(migrationsDir, migrationFile);
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        // Start transaction
        await sql`BEGIN`;
        
        // Split and execute each statement
        const statements = migrationContent
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        for (const statement of statements) {
          // Use raw SQL with template literal
          await sql`${statement}`;
        }
        
        // Record the migration
        await sql`INSERT INTO migrations (name) VALUES (${migrationFile})`;
        
        // Commit transaction
        await sql`COMMIT`;
        log(`Successfully applied migration: ${migrationFile}`, 'database');
      } catch (error) {
        // Rollback on error
        await sql`ROLLBACK`;
        throw new Error(`Error applying migration ${migrationFile}: ${error}`);
      }
    }
    
    log('All migrations completed successfully', 'database');
  } catch (error) {
    log(`Migration error: ${error}`, 'database');
    throw error;
  }
};

// Run migrations if this file is executed directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  runMigrations()
    .then(() => {
      log('Database migration completed', 'database');
      process.exit(0);
    })
    .catch((error) => {
      log(`Database migration failed: ${error}`, 'database');
      process.exit(1);
    });
}

export { runMigrations };
