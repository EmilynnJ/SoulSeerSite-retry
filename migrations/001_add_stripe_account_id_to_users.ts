import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN stripe_account_id text UNIQUE;
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE users
    DROP COLUMN IF EXISTS stripe_account_id;
  `);
}