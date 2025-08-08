import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE push_tokens (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id),
      token text UNIQUE NOT NULL,
      platform text,
      created_at timestamp DEFAULT now()
    );
    CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS push_tokens;`);
}