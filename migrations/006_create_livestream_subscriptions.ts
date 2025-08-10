import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE livestream_subscriptions (
      id serial PRIMARY KEY,
      livestream_id integer NOT NULL REFERENCES livestreams(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamp DEFAULT now(),
      reminder_sent_at timestamp,
      UNIQUE(livestream_id, user_id)
    );
    CREATE INDEX idx_livestream_subs_livestream ON livestream_subscriptions(livestream_id);
    CREATE INDEX idx_livestream_subs_user ON livestream_subscriptions(user_id);
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS livestream_subscriptions;`);
}