import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE content_flags (
      id serial PRIMARY KEY,
      type text NOT NULL CHECK (type IN ('post','comment','message','livestream')),
      target_id integer NOT NULL,
      reporter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason text,
      status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
      created_at timestamp DEFAULT now(),
      reviewed_by integer REFERENCES users(id),
      reviewed_at timestamp,
      notes text
    );
    CREATE INDEX idx_flags_type_target ON content_flags(type, target_id);
    CREATE INDEX idx_flags_status ON content_flags(status);
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS content_flags;`);
}