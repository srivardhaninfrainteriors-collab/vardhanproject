import {
  randomUUID,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const roles = ["admin", "manager", "agent"];
const priorities = ["normal", "high", "urgent"];
const sha = (s) => createHash("sha256").update(s).digest("hex");
const fail = (message, status = 400) => {
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
export function migrateCRM(db) {
  const columns = new Set(
    db
      .prepare("PRAGMA table_info(leads)")
      .all()
      .map((c) => c.name),
  );
  for (const [key, type] of Object.entries({
    source: "TEXT NOT NULL DEFAULT 'website'",
    source_id: "TEXT",
    owner_id: "TEXT",
    priority: "TEXT NOT NULL DEFAULT 'normal'",
    deal_value: "INTEGER NOT NULL DEFAULT 0",
    expected_close: "TEXT NOT NULL DEFAULT ''",
    updated_at: "TEXT NOT NULL DEFAULT ''",
    archived: "INTEGER NOT NULL DEFAULT 0",
    version: "INTEGER NOT NULL DEFAULT 1",
  }))
    if (!columns.has(key))
      db.exec(`ALTER TABLE leads ADD COLUMN ${key} ${type}`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS leads_source_id ON leads(source,source_id) WHERE source_id IS NOT NULL;
 CREATE INDEX IF NOT EXISTS leads_owner_status ON leads(owner_id,status,archived);
 CREATE TABLE IF NOT EXISTS crm_users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS crm_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS crm_activity(id TEXT PRIMARY KEY,lead_id TEXT,actor_id TEXT,kind TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS activity_lead ON crm_activity(lead_id,created_at);
 CREATE TABLE IF NOT EXISTS crm_tasks(id TEXT PRIMARY KEY,lead_id TEXT NOT NULL,owner_id TEXT,title TEXT NOT NULL,kind TEXT NOT NULL,due_at TEXT NOT NULL,completed_at TEXT,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS tasks_due ON crm_tasks(owner_id,completed_at,due_at);
 CREATE TABLE IF NOT EXISTS crm_proposals(id TEXT PRIMARY KEY,lead_id TEXT NOT NULL,number TEXT NOT NULL UNIQUE,title TEXT NOT NULL,items TEXT NOT NULL,tax_rate REAL NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL,valid_until TEXT NOT NULL,terms TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS crm_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 `);
  db.prepare(
    "UPDATE leads SET updated_at=created_at WHERE updated_at=''",
  ).run();
}
export async function createUser(
  db,
  { name, email, password, role = "agent" },
) {
  name = text(name, 100, true);
  email = text(email, 150, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail("Enter a valid email address.");
  if (!roles.includes(role)) fail("Invalid role.");
  const id = randomUUID();
  const encoded = await hashPassword(password);
  try {
    db.prepare(
      "INSERT INTO crm_users(id,name,email,password,role,created_at) VALUES(?,?,?,?,?,?)",
    ).run(id, name, email, encoded, role, now());
  } catch (e) {
    if (String(e.message).includes("UNIQUE constraint failed: crm_users.email"))
      fail("That email is already registered.", 409);
    throw e;
  }
  return { id, name, email, role, active: 1 };
}
export function createCRM({ db, statuses, json, body, limit, options = {} }) {
  migrateCRM(db);
  const secure = options.secureCookies ?? process.env.NODE_ENV === "production";
  function record(leadId, kind, message, actorId = null) {
    db.prepare("INSERT INTO crm_activity VALUES(?,?,?,?,?,?)").run(
      randomUUID(),
      leadId,
      actorId,
      kind,
      message,
      now(),
    );
  }
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      db.exec("COMMIT");
      return value;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  function onLeadCreated(id, source = "website", owner = null) {
    db.prepare(
      "UPDATE leads SET source=?,owner_id=?,updated_at=? WHERE id=?",
    ).run(source, owner, now(), id);
    record(
      id,
      "created",
      `${source === "meta" ? "Meta Lead Ads" : source === "manual" ? "Manual" : "Website"} inquiry received`,
    );
  }
  function session(req) {
    const cookie = String(req.headers.cookie || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("sv_crm="))
      ?.slice(7);
    if (!cookie) return null;
    return (
      db
        .prepare(
          "SELECT u.id,u.name,u.email,u.role,u.active,s.csrf,s.token_hash FROM crm_sessions s JOIN crm_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1",
        )
        .get(sha(cookie), Date.now()) || null
    );
  }
  function auth(req, write = false) {
    const user = session(req);
    if (!user) fail("Please sign in to your CRM.", 401);
    if (write && req.headers["x-csrf-token"] !== user.csrf)
      fail("Your session verification failed. Refresh and try again.", 403);
    return user;
  }
  const isManager = (user) => user.role === "admin" || user.role === "manager";
  const requireManager = (user) => {
    if (!isManager(user)) fail("Manager access required.", 403);
  };
  const requireAdmin = (user) => {
    if (user.role !== "admin") fail("Administrator access required.", 403);
  };
  function lead(id, user) {
    const row = db.prepare("SELECT * FROM leads WHERE id=?").get(id);
    if (!row || (user.role === "agent" && row.owner_id !== user.id))
      fail("Lead not found.", 404);
    return row;
  }
  function owner(id) {
    if (id !== null && (typeof id !== "string" || id.length !== 36))
      fail("Choose an active team member.");
    if (
      id !== null &&
      !db.prepare("SELECT id FROM crm_users WHERE id=? AND active=1").get(id)
    )
      fail("Choose an active team member.");
    return id;
  }
  function serialize(row) {
    return {
      ...JSON.parse(row.payload),
      ...Object.fromEntries(
        Object.entries(row).filter(
          ([k]) => k !== "payload" && k !== "request_id",
        ),
      ),
      owner_name: row.owner_id
        ? db.prepare("SELECT name FROM crm_users WHERE id=?").get(row.owner_id)
            ?.name
        : null,
    };
  }
  function where(params, user) {
    let query = "archived=?",
      values = [params.get("archived") === "1" ? 1 : 0];
    if (user.role === "agent") {
      query += " AND owner_id=?";
      values.push(user.id);
    }
    for (const key of ["status", "source", "priority", "owner_id"]) {
      const value = params.get(key);
      if (value) {
        if (key === "owner_id" && value === "unassigned")
          query += " AND owner_id IS NULL";
        else {
          query += ` AND ${key}=?`;
          values.push(value);
        }
      }
    }
    const q = params.get("q");
    if (q) {
      query +=
        " AND (json_extract(payload,'$.name') LIKE ? ESCAPE '\\' OR json_extract(payload,'$.phone') LIKE ? ESCAPE '\\' OR json_extract(payload,'$.email') LIKE ? ESCAPE '\\' OR json_extract(payload,'$.location') LIKE ? ESCAPE '\\')";
      const needle = `%${q.slice(0, 150).replace(/[\\%_]/g, "\\$&")}%`;
      values.push(needle, needle, needle, needle);
    }
    return { query, values };
  }
  function inputLead(input, existing = {}) {
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
  const isoDate = (v) => {
    if (typeof v !== "string" || !v || !Number.isFinite(Date.parse(v)))
      fail("Choose a valid date and time.");
    return new Date(v).toISOString();
  };
  function totals(items, tax) {
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
  async function handle(req, res, path, parsed, address, meta) {
    if (!path.startsWith("/api/crm/")) return false;
    const method = req.method;
    const route = path.slice("/api/crm".length);
    if (route === "/auth/login" && method === "POST") {
      if (!limit(`login:${sha(address)}`, 12, 900000))
        fail("Too many sign-in attempts. Try again in 15 minutes.", 429);
      const data = await body(req);
      const email = text(data.email, 150).toLowerCase();
      const user = db
        .prepare("SELECT * FROM crm_users WHERE email=? AND active=1")
        .get(email);
      // Always perform the expensive password check to reduce account enumeration by timing.
      const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
      const valid = await verify(data.password, user?.password || dummy);
      if (!user || !valid) fail("Email or password is incorrect.", 401);
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(24).toString("hex");
      db.prepare("DELETE FROM crm_sessions WHERE expires<?").run(Date.now());
      db.prepare("INSERT INTO crm_sessions VALUES(?,?,?,?)").run(
        sha(token),
        user.id,
        csrf,
        Date.now() + 12 * 3600000,
      );
      res.setHeader(
        "Set-Cookie",
        `sv_crm=${token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=43200${secure ? "; Secure" : ""}`,
      );
      json(res, 200, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        csrf,
      });
      return true;
    }
    const user = auth(req, !["GET", "HEAD"].includes(method));
    if (!limit(`crm:${user.id}`, 600, 60000))
      fail("Too many requests. Please wait a minute.", 429);
    if (route === "/auth/me" && method === "GET") {
      json(res, 200, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        csrf: user.csrf,
      });
      return true;
    }
    if (route === "/auth/logout" && method === "POST") {
      db.prepare("DELETE FROM crm_sessions WHERE token_hash=?").run(
        user.token_hash,
      );
      res.setHeader(
        "Set-Cookie",
        `sv_crm=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
      );
      json(res, 200, { ok: true });
      return true;
    }
    if (route === "/auth/password" && method === "POST") {
      if (!limit(`password:${user.id}`, 8, 900000))
        fail("Too many password attempts. Try again in 15 minutes.", 429);
      const input = await body(req);
      const current = db
        .prepare("SELECT password FROM crm_users WHERE id=?")
        .get(user.id);
      if (!(await verify(input.currentPassword, current.password)))
        fail("Current password is incorrect.", 403);
      const password = await hashPassword(input.password);
      transaction(() => {
        db.prepare("UPDATE crm_users SET password=? WHERE id=?").run(
          password,
          user.id,
        );
        db.prepare("DELETE FROM crm_sessions WHERE user_id=?").run(user.id);
      });
      json(res, 200, { ok: true, signInRequired: true });
      return true;
    }
    if (route === "/team" && method === "GET") {
      json(res, 200, {
        users: db
          .prepare(
            "SELECT id,name,email,role,active,created_at FROM crm_users ORDER BY name",
          )
          .all(),
      });
      return true;
    }
    if (route === "/team" && method === "POST") {
      requireAdmin(user);
      const member = await createUser(db, await body(req));
      record(null, "team", `Added ${member.name} as ${member.role}`, user.id);
      json(res, 201, { user: member });
      return true;
    }
    if (route.startsWith("/team/") && method === "PATCH") {
      requireAdmin(user);
      const id = route.split("/")[2],
        member = db.prepare("SELECT * FROM crm_users WHERE id=?").get(id);
      if (!member) fail("Team member not found.", 404);
      const input = await body(req);
      if (
        id === user.id &&
        (input.active === false || (input.role && input.role !== "admin"))
      )
        fail("You cannot remove your own administrator access.");
      if (input.active !== undefined && typeof input.active !== "boolean")
        fail("Choose an access state.");
      const role = input.role ?? member.role;
      if (!roles.includes(role)) fail("Invalid role.");
      const active =
        input.active === undefined
          ? member.active
          : input.active === true
            ? 1
            : 0;
      if (
        member.role === "admin" &&
        (role !== "admin" || !active) &&
        db
          .prepare(
            "SELECT COUNT(*) n FROM crm_users WHERE role='admin' AND active=1",
          )
          .get().n <= 1
      )
        fail("Keep at least one active administrator.");
      const password = input.password
        ? await hashPassword(input.password)
        : member.password;
      transaction(() => {
        db.prepare(
          "UPDATE crm_users SET role=?,active=?,password=? WHERE id=?",
        ).run(role, active, password, id);
        db.prepare("DELETE FROM crm_sessions WHERE user_id=?").run(id);
        record(null, "team", `Updated access for ${member.name}`, user.id);
      });
      json(res, 200, { ok: true });
      return true;
    }
    if (route === "/dashboard" && method === "GET") {
      const scope = user.role === "agent" ? " AND owner_id=?" : "",
        params = user.role === "agent" ? [user.id] : [];
      // ponytail: small-team reporting in memory; use grouped SQL aggregates for large installations.
      const rows = db
        .prepare(`SELECT * FROM leads WHERE archived=0${scope}`)
        .all(...params);
      const stages = statuses.map((status) => ({
        status,
        count: rows.filter((r) => r.status === status).length,
        value: rows
          .filter((r) => r.status === status)
          .reduce((a, r) => a + r.deal_value, 0),
      }));
      const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
      const overdue = db
        .prepare(
          `SELECT COUNT(*) n FROM crm_tasks t JOIN leads l ON l.id=t.lead_id WHERE t.completed_at IS NULL AND t.due_at<? AND l.archived=0${user.role === "agent" ? " AND l.owner_id=?" : ""}`,
        )
        .get(now(), ...params).n;
      const sources = ["website", "meta", "manual"].map((source) => ({
        source,
        count: rows.filter((r) => r.source === source).length,
        won: rows.filter((r) => r.source === source && r.status === "won")
          .length,
      }));
      json(res, 200, {
        total: rows.length,
        newThisWeek: rows.filter((r) => r.created_at >= cutoff).length,
        active: rows.filter((r) => !["won", "lost"].includes(r.status)).length,
        wonValue: stages.find((s) => s.status === "won").value,
        pipelineValue: rows
          .filter((r) => !["won", "lost"].includes(r.status))
          .reduce((a, r) => a + r.deal_value, 0),
        overdue,
        stages,
        sources,
        recent: rows
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 6)
          .map(serialize),
      });
      return true;
    }
    if ((route === "/leads" || route === "/export") && method === "GET") {
      const { query, values } = where(parsed.searchParams, user);
      const total = db
        .prepare(`SELECT COUNT(*) n FROM leads WHERE ${query}`)
        .get(...values).n;
      const limitRows = route === "/export" ? 10000 : 100,
        offset =
          route === "/export"
            ? 0
            : Math.max(
                0,
                Number.parseInt(parsed.searchParams.get("offset") || "0", 10) ||
                  0,
              );
      const rows = db
        .prepare(
          `SELECT * FROM leads WHERE ${query} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
        )
        .all(...values, limitRows, offset)
        .map(serialize);
      if (route === "/export") {
        if (total > 10000)
          fail("Narrow your filters to export at most 10,000 leads.");
        const keys = [
          "name",
          "phone",
          "email",
          "service",
          "location",
          "status",
          "source",
          "owner_name",
          "priority",
          "deal_value",
          "created_at",
        ];
        const safe = (v) =>
          '"' +
          String(v ?? "")
            .replace(/^[\s]*[=+@-]/, "' $&")
            .replaceAll('"', '""') +
          '"';
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="srivardhan-leads.csv"',
          "Cache-Control": "no-store",
        });
        res.end(
          "\uFEFF" +
            [
              keys.join(","),
              ...rows.map((r) =>
                keys
                  .map((k) => safe(k === "deal_value" ? r[k] / 100 : r[k]))
                  .join(","),
              ),
            ].join("\r\n"),
        );
        return true;
      }
      json(res, 200, { leads: rows, total, offset });
      return true;
    }
    if (route === "/leads" && method === "POST") {
      const input = await body(req),
        payload = inputLead(input);
      const id = randomUUID();
      const ownerId = isManager(user) ? owner(input.owner_id || null) : user.id;
      payload.consent = false;
      payload.marketingConsent = false;
      payload.consentBasis = text(input.consentBasis, 300, true);
      transaction(() => {
        db.prepare(
          "INSERT INTO leads(id,request_id,created_at,status,payload) VALUES(?,?,?,?,?)",
        ).run(id, randomUUID(), now(), "new", JSON.stringify(payload));
        onLeadCreated(id, "manual", ownerId);
        record(id, "note", `Created by ${user.name}`, user.id);
      });
      json(res, 201, { id });
      return true;
    }
    const match = route.match(
      /^\/leads\/([0-9a-f-]{36})(?:\/(notes|tasks|proposals))?$/i,
    );
    if (match) {
      const id = match[1],
        action = match[2];
      let row = lead(id, user);
      if (!action && method === "GET") {
        const payload = JSON.parse(row.payload);
        // ponytail: scan scoped contacts for matches; add indexed normalized contact columns at larger volumes.
        const duplicates = db
          .prepare(
            `SELECT id,payload,status FROM leads WHERE id!=? AND archived=0${user.role === "agent" ? " AND owner_id=?" : ""}`,
          )
          .all(id, ...(user.role === "agent" ? [user.id] : []))
          .filter((r) => {
            const p = JSON.parse(r.payload);
            return (
              (payload.phone &&
                p.phone &&
                p.phone.replace(/\D/g, "") ===
                  payload.phone.replace(/\D/g, "")) ||
              (payload.email &&
                p.email &&
                p.email.toLowerCase() === payload.email.toLowerCase())
            );
          })
          .map((r) => ({
            id: r.id,
            name: JSON.parse(r.payload).name,
            status: r.status,
          }));
        json(res, 200, {
          lead: serialize(row),
          activity: db
            .prepare(
              "SELECT a.*,u.name actor_name FROM crm_activity a LEFT JOIN crm_users u ON a.actor_id=u.id WHERE a.lead_id=? ORDER BY a.created_at DESC",
            )
            .all(id),
          tasks: db
            .prepare(
              "SELECT t.*,u.name owner_name FROM crm_tasks t LEFT JOIN crm_users u ON t.owner_id=u.id WHERE t.lead_id=? ORDER BY t.due_at",
            )
            .all(id),
          proposals: db
            .prepare(
              "SELECT * FROM crm_proposals WHERE lead_id=? ORDER BY created_at DESC",
            )
            .all(id)
            .map((r) => ({ ...r, items: JSON.parse(r.items) })),
          duplicates,
        });
        return true;
      }
      if (!action && method === "PATCH") {
        const input = await body(req);
        row = lead(id, auth(req, true));
        if (input.version !== row.version)
          fail(
            "This lead changed since you opened it. Refresh before saving.",
            409,
          );
        const payload = inputLead(input, JSON.parse(row.payload)),
          status = input.status ?? row.status;
        if (!statuses.includes(status)) fail("Invalid stage.");
        const priority = input.priority ?? row.priority;
        if (!priorities.includes(priority)) fail("Invalid priority.");
        const ownerId =
          input.owner_id === undefined
            ? row.owner_id
            : owner(input.owner_id || null);
        if (ownerId !== row.owner_id) requireManager(user);
        const value =
          input.deal_value === undefined
            ? row.deal_value
            : Number(input.deal_value);
        if (!Number.isSafeInteger(value) || value < 0 || value > 1e14)
          fail("Invalid project value.");
        const expected =
          input.expected_close === undefined
            ? row.expected_close
            : input.expected_close
              ? isoDate(input.expected_close).slice(0, 10)
              : "";
        if (status === "lost" && !payload.lostReason)
          fail("Add a reason before marking a lead lost.");
        if (input.archived !== undefined && typeof input.archived !== "boolean")
          fail("Choose an archive state.");
        const archived =
          input.archived === undefined ? row.archived : input.archived ? 1 : 0;
        if (archived !== row.archived) requireManager(user);
        transaction(() => {
          db.prepare(
            "UPDATE leads SET payload=?,status=?,owner_id=?,priority=?,deal_value=?,expected_close=?,archived=?,updated_at=?,version=version+1 WHERE id=?",
          ).run(
            JSON.stringify(payload),
            status,
            ownerId,
            priority,
            value,
            expected,
            archived,
            now(),
            id,
          );
          record(
            id,
            "update",
            status !== row.status
              ? `Stage changed from ${row.status} to ${status}`
              : archived !== row.archived
                ? archived
                  ? "Lead archived"
                  : "Lead restored"
                : "Project details updated",
            user.id,
          );
        });
        json(res, 200, { id, version: row.version + 1 });
        return true;
      }
      if (action === "notes" && method === "POST") {
        const input = await body(req);
        const kind = ["note", "call", "meeting", "email", "whatsapp"].includes(
          input.kind,
        )
          ? input.kind
          : "note";
        record(id, kind, text(input.body, 4000, true), user.id);
        json(res, 201, { ok: true });
        return true;
      }
      if (action === "tasks" && method === "POST") {
        const input = await body(req);
        const title = text(input.title, 200, true),
          due = isoDate(input.due_at);
        const kind = [
          "follow-up",
          "call",
          "site visit",
          "proposal",
          "meeting",
        ].includes(input.kind)
          ? input.kind
          : "follow-up";
        const ownerId = isManager(user)
          ? owner(input.owner_id || row.owner_id || user.id)
          : user.id;
        const taskOwner = db
          .prepare("SELECT role FROM crm_users WHERE id=?")
          .get(ownerId);
        if (taskOwner.role === "agent" && ownerId !== row.owner_id)
          fail(
            "Assign the lead to this agent before scheduling their follow-up.",
          );
        const taskId = randomUUID();
        transaction(() => {
          db.prepare("INSERT INTO crm_tasks VALUES(?,?,?,?,?,?,NULL,?)").run(
            taskId,
            id,
            ownerId,
            title,
            kind,
            due,
            now(),
          );
          record(id, "task", `Scheduled ${kind}: ${title}`, user.id);
        });
        json(res, 201, { id: taskId });
        return true;
      }
      if (action === "proposals" && method === "POST") {
        const input = await body(req),
          proposal = totals(input.items, input.tax_rate || 0),
          proposalId = randomUUID();
        const number = `SV-${new Date().getFullYear()}-${proposalId.slice(0, 8).toUpperCase()}`;
        const title = text(input.title, 200, true),
          terms = text(input.terms, 4000),
          valid = isoDate(input.valid_until).slice(0, 10);
        transaction(() => {
          db.prepare(
            "INSERT INTO crm_proposals VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          ).run(
            proposalId,
            id,
            number,
            title,
            JSON.stringify(proposal.items),
            proposal.tax,
            proposal.total,
            "draft",
            valid,
            terms,
            now(),
          );
          record(id, "proposal", `Created proposal ${number}`, user.id);
        });
        json(res, 201, { id: proposalId, number, total: proposal.total });
        return true;
      }
    }
    if (route === "/tasks" && method === "GET") {
      const tasks = db
        .prepare(
          `SELECT t.*,l.payload,l.status lead_status,u.name owner_name FROM crm_tasks t JOIN leads l ON l.id=t.lead_id LEFT JOIN crm_users u ON u.id=t.owner_id WHERE l.archived=0${user.role === "agent" ? " AND l.owner_id=?" : ""} ORDER BY t.completed_at IS NOT NULL,t.due_at LIMIT 1000`,
        )
        .all(...(user.role === "agent" ? [user.id] : []))
        .map(({ payload, ...t }) => ({
          ...t,
          lead_name: JSON.parse(payload).name,
        }));
      json(res, 200, { tasks });
      return true;
    }
    if (/^\/tasks\/[0-9a-f-]{36}$/.test(route) && method === "PATCH") {
      const id = route.split("/")[2],
        task = db.prepare("SELECT * FROM crm_tasks WHERE id=?").get(id);
      if (!task) fail("Task not found.", 404);
      lead(task.lead_id, user);
      const input = await body(req);
      lead(task.lead_id, auth(req, true));
      if (input.completed !== undefined && typeof input.completed !== "boolean")
        fail("Choose a completion state.");
      const title =
        input.title === undefined ? task.title : text(input.title, 200, true);
      const due =
        input.due_at === undefined ? task.due_at : isoDate(input.due_at);
      const kind = input.kind ?? task.kind;
      if (
        !["follow-up", "call", "site visit", "proposal", "meeting"].includes(
          kind,
        )
      )
        fail("Choose a valid task type.");
      transaction(() => {
        db.prepare(
          "UPDATE crm_tasks SET completed_at=?,title=?,due_at=?,kind=? WHERE id=?",
        ).run(
          input.completed === undefined
            ? task.completed_at
            : input.completed
              ? now()
              : null,
          title,
          due,
          kind,
          id,
        );
        record(
          task.lead_id,
          "task",
          `${input.completed === undefined ? "Updated follow-up" : input.completed ? "Completed" : "Reopened"}: ${title}`,
          user.id,
        );
      });
      json(res, 200, { ok: true });
      return true;
    }
    if (/^\/proposals\/[0-9a-f-]{36}$/.test(route) && method === "PATCH") {
      const id = route.split("/")[2],
        proposal = db.prepare("SELECT * FROM crm_proposals WHERE id=?").get(id);
      if (!proposal) fail("Proposal not found.", 404);
      lead(proposal.lead_id, user);
      const input = await body(req);
      if (!["draft", "sent", "accepted", "declined"].includes(input.status))
        fail("Invalid proposal status.");
      transaction(() => {
        db.prepare("UPDATE crm_proposals SET status=? WHERE id=?").run(
          input.status,
          id,
        );
        record(
          proposal.lead_id,
          "proposal",
          `Proposal ${proposal.number} marked ${input.status}`,
          user.id,
        );
      });
      json(res, 200, { ok: true });
      return true;
    }
    if (route.startsWith("/meta")) {
      requireAdmin(user);
      return meta.handleAdmin(req, res, route, parsed, user);
    }
    json(res, 404, { error: "CRM endpoint not found." });
    return true;
  }
  return { handle, record, onLeadCreated, transaction, auth, serialize };
}
