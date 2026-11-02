import {
  randomUUID,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { sql, db } from "@vercel/postgres";

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
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'website'`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_id TEXT`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_id TEXT`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_value BIGINT NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS expected_close TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS archived INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS leads_source_id ON leads(source,source_id) WHERE source_id IS NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS leads_owner_status ON leads(owner_id,status,archived)`;
      await sql`CREATE TABLE IF NOT EXISTS crm_users(
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS crm_sessions(
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, expires BIGINT NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS crm_activity(
        id TEXT PRIMARY KEY, lead_id TEXT, actor_id TEXT, kind TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS activity_lead ON crm_activity(lead_id,created_at)`;
      await sql`CREATE TABLE IF NOT EXISTS crm_tasks(
        id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, owner_id TEXT, title TEXT NOT NULL, kind TEXT NOT NULL,
        due_at TEXT NOT NULL, completed_at TEXT, created_at TEXT NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS tasks_due ON crm_tasks(owner_id,completed_at,due_at)`;
      await sql`CREATE TABLE IF NOT EXISTS crm_proposals(
        id TEXT PRIMARY KEY, lead_id TEXT NOT NULL, number TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
        items TEXT NOT NULL, tax_rate REAL NOT NULL, total BIGINT NOT NULL, status TEXT NOT NULL,
        valid_until TEXT NOT NULL, terms TEXT NOT NULL, created_at TEXT NOT NULL
      )`;
      await sql`UPDATE leads SET updated_at=created_at WHERE updated_at=''`;
    })();
  return ready;
}

export async function createUser({ name, email, password, role = "agent" }) {
  name = text(name, 100, true);
  email = text(email, 150, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail("Enter a valid email address.");
  if (!roles.includes(role)) fail("Invalid role.");
  const id = randomUUID();
  const encoded = await hashPassword(password);
  const { rows } = await sql`SELECT id FROM crm_users WHERE email=${email}`;
  if (rows[0]) fail("That email is already registered.", 409);
  await sql`
    INSERT INTO crm_users(id,name,email,password,role,created_at)
    VALUES (${id}, ${name}, ${email}, ${encoded}, ${role}, ${now()})
  `;
  return { id, name, email, role, active: 1 };
}

export async function record(leadId, kind, message, actorId = null) {
  await sql`
    INSERT INTO crm_activity VALUES (${randomUUID()}, ${leadId}, ${actorId}, ${kind}, ${message}, ${now()})
  `;
}

export async function onLeadCreated(id, source = "website", owner = null) {
  await sql`UPDATE leads SET source=${source}, owner_id=${owner}, updated_at=${now()} WHERE id=${id}`;
  await record(
    id,
    "created",
    `${source === "meta" ? "Meta Lead Ads" : source === "manual" ? "Manual" : "Website"} inquiry received`,
  );
}

export async function withTransaction(fn) {
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    const value = await fn(client);
    await client.sql`COMMIT`;
    return value;
  } catch (e) {
    await client.sql`ROLLBACK`;
    throw e;
  } finally {
    client.release();
  }
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
  const { rows } = await sql`
    SELECT u.id,u.name,u.email,u.role,u.active,s.csrf,s.token_hash
    FROM crm_sessions s JOIN crm_users u ON u.id=s.user_id
    WHERE s.token_hash=${sha(cookie)} AND s.expires>${Date.now()} AND u.active=1
  `;
  return rows[0] || null;
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
  const { rows } = await sql`SELECT * FROM leads WHERE id=${id}`;
  const row = rows[0];
  if (!row || (user.role === "agent" && row.owner_id !== user.id))
    fail("Lead not found.", 404);
  return row;
}

export async function owner(id) {
  if (id !== null && (typeof id !== "string" || id.length !== 36))
    fail("Choose an active team member.");
  if (id !== null) {
    const { rows } = await sql`SELECT id FROM crm_users WHERE id=${id} AND active=1`;
    if (!rows[0]) fail("Choose an active team member.");
  }
  return id;
}

export async function serialize(row) {
  const payload = row.payload;
  const { lead_id, token_hash, csrf, ...rest } = row;
  let owner_name = null;
  if (row.owner_id) {
    const { rows } = await sql`SELECT name FROM crm_users WHERE id=${row.owner_id}`;
    owner_name = rows[0]?.name ?? null;
  }
  return { ...payload, ...rest, owner_name };
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
  let clauses = ["archived=$1"],
    values = [params.get("archived") === "1" ? 1 : 0];
  if (user.role === "agent") {
    values.push(user.id);
    clauses.push(`owner_id=$${values.length}`);
  }
  for (const key of ["status", "source", "priority", "owner_id"]) {
    const value = params.get(key);
    if (value) {
      if (key === "owner_id" && value === "unassigned")
        clauses.push("owner_id IS NULL");
      else {
        values.push(value);
        clauses.push(`${key}=$${values.length}`);
      }
    }
  }
  const q = params.get("q");
  if (q) {
    const needle = `%${q.slice(0, 150).replace(/[\\%_]/g, "\\$&")}%`;
    values.push(needle, needle, needle, needle);
    const n = values.length;
    clauses.push(
      `(payload->>'name' ILIKE $${n - 3} ESCAPE '\\' OR payload->>'phone' ILIKE $${n - 2} ESCAPE '\\' OR payload->>'email' ILIKE $${n - 1} ESCAPE '\\' OR payload->>'location' ILIKE $${n} ESCAPE '\\')`,
    );
  }
  return { clause: clauses.join(" AND "), values };
}
