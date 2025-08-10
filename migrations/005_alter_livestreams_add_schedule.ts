import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE livestreams
      ADD COLUMN title text,
      ADD COLUMN description text,
      ADD COLUMN scheduled_for timestamp,
      ADD COLUMN reminder_sent boolean DEFAULT false;
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE livestreams
      DROP COLUMN IF EXISTS title,
      DROP COLUMN IF EXISTS description,
      DROP COLUMN IF EXISTS scheduled_for,
      DROP COLUMN IF EXISTS reminder_sent;
  `);
}