import { MongoClient } from "mongodb";

let clientPromise;
function client() {
  if (!clientPromise) {
    if (!process.env.MONGODB_URI) throw Error("MONGODB_URI is not configured.");
    clientPromise = new MongoClient(process.env.MONGODB_URI, { family: 4 }).connect();
  }
  return clientPromise;
}

export async function getDb() {
  const c = await client();
  return c.db(process.env.MONGODB_DB || "srivardhan");
}
