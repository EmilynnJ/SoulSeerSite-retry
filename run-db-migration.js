import { execSync } from 'child_process';

// Get the DATABASE_URL from environment
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

try {
  // Set the environment variable for the command
  const env = { ...process.env, POSTGRES_URL: dbUrl };
  
  // Run the drizzle-kit push command
  console.log('Running database migration...');
  const output = execSync('npx drizzle-kit push:pg', { env, encoding: 'utf8' });
  
  console.log(output);
  console.log('Database migration completed successfully');
} catch (error) {
  console.error('Error running database migration:', error.message);
  process.exit(1);
}