import { sql } from "@vercel/postgres";

let ready;
export function ensureSchema() {
  if (!ready)
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        request_id TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL,
        payload JSONB NOT NULL,
        notification_status TEXT NOT NULL DEFAULT 'not_configured'
      )`;
      await sql`CREATE TABLE IF NOT EXISTS audit (
        id SERIAL PRIMARY KEY,
        lead_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        expires BIGINT NOT NULL
      )`;
    })();
  return ready;
}

export async function limit(key, max, windowMs) {
  const now = Date.now();
  await sql`DELETE FROM rate_limits WHERE expires < ${now}`;
  const { rows } = await sql`SELECT count FROM rate_limits WHERE key=${key}`;
  if (rows[0] && rows[0].count >= max) return false;
  await sql`
    INSERT INTO rate_limits(key, count, expires) VALUES (${key}, 1, ${now + windowMs})
    ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1
  `;
  return true;
}
