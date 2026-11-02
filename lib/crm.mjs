import {
  randomUUID,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { getDb } from "./mongo.mjs";

const scrypt = promisify(scryptCallback);
export const roles = ["admin", "manager", "agent"];
export const priorities = ["normal", "high", "urgent"];
export const sha = (s) => createHash("sha256").update(s).digest("hex");
export const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
const now = () => new Date().toISOString();

export const text = (v, max = 200, required = false) => {
  if (v === undefined || v === null) v = "";
  if (typeof v !== "string" || v.length > max)
    fail(`Use text no longer than ${max} characters.`);
  v = v.trim();
  if (required && !v) fail("Please complete the required fields.");
  return v;
};

export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    fail("Use a password between 12 and 128 characters.");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${Buffer.from(await scrypt(password, salt, 64)).toString("hex")}`;
}

async function verify(password, hash) {
  if (typeof password !== "string" || password.length > 128) return false;
  const [salt, key] = hash.split(":");
  const result = Buffer.from(await scrypt(password, salt, 64));
  return timingSafeEqual(result, Buffer.from(key, "hex"));
}

let ready;
export function ensureCRMSchema() {
  if (!ready)
    ready = (async () => {
      const db = await getDb();
      await db.collection("crm_users").createIndex({ email: 1 }, { unique: true });
      await db
        .collection("leads")
        .createIndex(
          { source: 1, source_id: 1 },
          { unique: true, partialFilterExpression: { source_id: { $exists: true } } },
        );
      await db.collection("leads").createIndex({ owner_id: 1, status: 1, archived: 1 });
      await db.collection("crm_activity").createIndex({ lead_id: 1, created_at: 1 });
      await db.collection("crm_tasks").createIndex({ owner_id: 1, completed_at: 1, due_at: 1 });
      // Website inquiries are stored by the public form without CRM fields; normalise them.
      const leads = db.collection("leads");
      await leads.updateMany({ archived: { $exists: false } }, { $set: { archived: 0 } });
      await leads.updateMany({ source: { $exists: false } }, { $set: { source: "website" } });
      await leads.updateMany({ priority: { $exists: false } }, { $set: { priority: "normal" } });
      await leads.updateMany({ deal_value: { $exists: false } }, { $set: { deal_value: 0 } });
      await leads.updateMany({ version: { $exists: false } }, { $set: { version: 1 } });
      await leads.updateMany({ owner_id: { $exists: false } }, { $set: { owner_id: null } });
    })();
  return ready;
}

export async function createUser({ name, email, password, role = "agent" }) {
  name = text(name, 100, true);
  email = text(email, 150, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail("Enter a valid email address.");
  if (!roles.includes(role)) fail("Invalid role.");
  const db = await getDb();
  const existing = await db.collection("crm_users").findOne({ email });
  if (existing) fail("That email is already registered.", 409);
  const id = randomUUID();
  const encoded = await hashPassword(password);
  await db.collection("crm_users").insertOne({
    _id: id,
    name,
    email,
    password: encoded,
    role,
    active: 1,
    created_at: now(),
  });
  return { id, name, email, role, active: 1 };
}

export async function record(leadId, kind, message, actorId = null) {
  const db = await getDb();
  await db.collection("crm_activity").insertOne({
    _id: randomUUID(),
    lead_id: leadId,
    actor_id: actorId,
    kind,
    body: message,
    created_at: now(),
  });
}

export async function onLeadCreated(id, source = "website", owner = null) {
  const db = await getDb();
  await db.collection("leads").updateOne(
    { _id: id },
    { $set: { source, owner_id: owner, updated_at: now() } },
  );
  await record(
    id,
    "created",
    `${source === "meta" ? "Meta Lead Ads" : source === "manual" ? "Manual" : "Website"} inquiry received`,
  );
}

export function cookieToken(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("sv_crm="))
    ?.slice(7);
}

export async function session(req) {
  const cookie = cookieToken(req);
  if (!cookie) return null;
  const db = await getDb();
  const tokenHash = sha(cookie);
  const s = await db.collection("crm_sessions").findOne({ _id: tokenHash, expires: { $gt: Date.now() } });
  if (!s) return null;
  const u = await db.collection("crm_users").findOne({ _id: s.user_id, active: 1 });
  if (!u) return null;
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    csrf: s.csrf,
    token_hash: s._id,
  };
}

export async function auth(req, write = false) {
  const user = await session(req);
  if (!user) fail("Please sign in to your CRM.", 401);
  if (write && req.headers["x-csrf-token"] !== user.csrf)
    fail("Your session verification failed. Refresh and try again.", 403);
  return user;
}

export const isManager = (user) => user.role === "admin" || user.role === "manager";
export const requireManager = (user) => {
  if (!isManager(user)) fail("Manager access required.", 403);
};
export const requireAdmin = (user) => {
  if (user.role !== "admin") fail("Administrator access required.", 403);
};

export async function lead(id, user) {
  const db = await getDb();
  const row = await db.collection("leads").findOne({ _id: id });
  if (!row || (user.role === "agent" && row.owner_id !== user.id))
    fail("Lead not found.", 404);
  return row;
}

export async function owner(id) {
  if (id !== null && (typeof id !== "string" || id.length !== 36))
    fail("Choose an active team member.");
  if (id !== null) {
    const db = await getDb();
    const u = await db.collection("crm_users").findOne({ _id: id, active: 1 });
    if (!u) fail("Choose an active team member.");
  }
  return id;
}

export async function serialize(row) {
  const { _id, payload, owner_id, ...rest } = row;
  let owner_name = null;
  if (owner_id) {
    const db = await getDb();
    const o = await db.collection("crm_users").findOne({ _id: owner_id }, { projection: { name: 1 } });
    owner_name = o?.name ?? null;
  }
  return { ...payload, ...rest, id: _id, owner_id, owner_name };
}

export function inputLead(input, existing = {}) {
  const result = { ...existing };
  for (const [k, max] of Object.entries({
    name: 100,
    phone: 30,
    email: 150,
    service: 100,
    location: 150,
    property: 50,
    area: 20,
    budget: 100,
    timeline: 100,
    company: 150,
    message: 4000,
    tags: 200,
    consentBasis: 300,
    lostReason: 500,
  }))
    if (input[k] !== undefined) result[k] = text(input[k], max);
  if (!result.name) fail("Lead name is required.");
  if (result.phone && !/^[+0-9 ()-]{7,30}$/.test(result.phone))
    fail("Enter a valid phone number.");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    fail("Enter a valid email.");
  if (!result.phone && !result.email)
    fail("A phone number or email is required.");
  return result;
}

export const isoDate = (v) => {
  if (typeof v !== "string" || !v || !Number.isFinite(Date.parse(v)))
    fail("Choose a valid date and time.");
  return new Date(v).toISOString();
};

export function totals(items, tax) {
  if (!Array.isArray(items) || !items.length || items.length > 50)
    fail("Add 1–50 proposal items.");
  const clean = items.map((i) => {
    if (!i || typeof i !== "object" || Array.isArray(i))
      fail("Invalid proposal item.");
    const description = text(i.description, 250, true),
      quantity = Number(i.quantity),
      price = Number(i.price);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 1e6 ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 1e9
    )
      fail("Invalid item quantity or unit price.");
    return { description, quantity, price: Math.round(price * 100) / 100 };
  });
  tax = Number(tax);
  if (!Number.isFinite(tax) || tax < 0 || tax > 100)
    fail("Invalid tax percentage.");
  const subtotal = clean.reduce(
    (a, i) => a + Math.round(i.quantity * i.price * 100),
    0,
  );
  const total = subtotal + Math.round((subtotal * tax) / 100);
  if (!Number.isSafeInteger(total) || total > 1e14)
    fail("Proposal total exceeds the supported amount.");
  return { items: clean, tax, total };
}

export function buildWhere(params, user) {
  const filter = { archived: params.get("archived") === "1" ? 1 : 0 };
  if (user.role === "agent") filter.owner_id = user.id;
  for (const key of ["status", "source", "priority", "owner_id"]) {
    const value = params.get(key);
    if (value) {
      if (key === "owner_id" && value === "unassigned") filter.owner_id = null;
      else filter[key] = value;
    }
  }
  const q = params.get("q");
  if (q) {
    const needle = q.slice(0, 150);
    const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { "payload.name": re },
      { "payload.phone": re },
      { "payload.email": re },
      { "payload.location": re },
    ];
  }
  return filter;
}
