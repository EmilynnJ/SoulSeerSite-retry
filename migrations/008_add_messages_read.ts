import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  // Add read column if not exists
  await db.execute(sql`
    ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS read boolean DEFAULT false;
  `);
  // Backfill: set read true where read_at is not null
  await db.execute(sql`
    UPDATE messages SET read = TRUE WHERE read = FALSE AND read_at IS NOT NULL;
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE messages
      DROP COLUMN IF EXISTS read;
  `);
}