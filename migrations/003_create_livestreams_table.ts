import { sql } from "drizzle-orm";

export async function up(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE livestreams (
      id serial PRIMARY KEY,
      reader_id integer NOT NULL REFERENCES users(id),
      mux_stream_key text UNIQUE NOT NULL,
      mux_playback_id text UNIQUE NOT NULL,
      status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended')),
      viewer_count integer DEFAULT 0,
      created_at timestamp DEFAULT now(),
      ended_at timestamp
    );
    CREATE INDEX idx_livestreams_reader_id ON livestreams(reader_id);
    CREATE INDEX idx_livestreams_status ON livestreams(status);
  `);
}

export async function down(db: any): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS livestreams;`);
}