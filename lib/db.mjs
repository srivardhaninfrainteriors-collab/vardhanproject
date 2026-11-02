import { getDb } from "./mongo.mjs";

let ready;
export function ensureSchema() {
  if (!ready)
    ready = (async () => {
      const db = await getDb();
      await db.collection("leads").createIndex({ request_id: 1 }, { unique: true });
    })();
  return ready;
}

export async function limit(key, max, windowMs) {
  const db = await getDb();
  const now = Date.now();
  const col = db.collection("rate_limits");
  await col.deleteMany({ expires: { $lt: now } });
  const existing = await col.findOne({ _id: key });
  if (existing && existing.count >= max) return false;
  await col.updateOne(
    { _id: key },
    { $inc: { count: 1 }, $setOnInsert: { expires: now + windowMs } },
    { upsert: true },
  );
  return true;
}

export { getDb };
