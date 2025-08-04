import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE payouts (
      id serial PRIMARY KEY,
      reader_id integer NOT NULL REFERENCES users(id),
      amount_cents integer NOT NULL,
      status text NOT NULL CHECK (status IN ('pending','paid','failed')),
      stripe_transfer_id text,
      created_at timestamp DEFAULT now(),
      paid_at timestamp,
      failure_reason text
    );
    CREATE INDEX idx_payouts_reader_id ON payouts(reader_id);
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS payouts;`);
}