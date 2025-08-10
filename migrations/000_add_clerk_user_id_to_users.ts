import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN clerk_user_id text UNIQUE;
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE users
    DROP COLUMN IF EXISTS clerk_user_id;
  `);
}