import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
export const statuses = [
  "new",
  "contacted",
  "qualified",
  "site visit",
  "proposal",
  "negotiation",
  "won",
  "lost",
];
const serviceNames = [
  "Luxury interior design",
  "Premium home interiors",
  "Residential construction",
  "Villas & independent homes",
  "Commercial interiors & construction",
  "Office & retail fit-outs",
  "Renovations & transformations",
  "Builder & developer partnerships",
];
const properties = [
  "Apartment",
  "Independent home",
  "Villa",
  "Plot",
  "Office",
  "Retail",
  "Development",
  "Other",
];
const fields = {
  name: 100,
  phone: 20,
  service: 100,
  location: 150,
  property: 50,
  area: 20,
  budget: 100,
  timeline: 100,
  company: 150,
  message: 2000,
  page: 300,
  campaign: 50,
};
export function validateLead(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid inquiry.");
  if (input.website)
    throw Error("Unable to accept this inquiry. Please contact us directly.");
  if (input.consent !== true)
    throw Error("Please agree to be contacted about your inquiry.");
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId || ""))
    throw Error("Invalid inquiry reference. Please refresh and try again.");
  const data = {};
  for (const [key, max] of Object.entries(fields)) {
    if (input[key] !== undefined && typeof input[key] !== "string")
      throw Error(`Invalid ${key}.`);
    data[key] = (input[key] || "").trim();
    if (data[key].length > max) throw Error(`${key} is too long.`);
  }
  if (
    data.name.length < 2 ||
    !data.location ||
    !serviceNames.includes(data.service) ||
    !properties.includes(data.property)
  )
    throw Error(
      "Please complete your name, service, location and property type.",
    );
  const digits = data.phone.replace(/\D/g, "");
  if (
    digits.length < 10 ||
    digits.length > 15 ||
    !/^[+0-9 ()-]+$/.test(data.phone)
  )
    throw Error("Enter a valid phone number with 10–15 digits.");
  if (
    data.area &&
    (!/^\d+(\.\d+)?$/.test(data.area) ||
      Number(data.area) <= 0 ||
      Number(data.area) > 1e7)
  )
    throw Error("Enter a valid project area.");
  data.requestId = input.requestId;
  data.consent = true;
  data.analyticsConsent = input.analyticsConsent === true;
  data.marketingConsent = input.marketingConsent === true;
  data.attribution = {};
  if (data.analyticsConsent || data.marketingConsent)
    for (const k of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ])
      if (typeof input.attribution?.[k] === "string")
        data.attribution[k] = input.attribution[k].slice(0, 150);
  return data;
}
export function createLeadServer(options = {}) {
  const dbPath = options.dbPath || process.env.LEADS_DB || "data/leads.sqlite";
  if (dbPath !== ":memory:")
    mkdirSync(dirname(resolve(dbPath)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  db.exec(
    `CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL,payload TEXT NOT NULL,notification_status TEXT NOT NULL DEFAULT 'not_configured'); CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,lead_id TEXT,created_at TEXT,status TEXT); CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`,
  );
  const adminToken = options.adminToken ?? process.env.ADMIN_TOKEN;
  const origins =
    options.origins ||
    (
      process.env.ALLOWED_ORIGINS ||
      "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173"
    ).split(",");
  const frontendOrigin =
    process.env.SITE_URL ||
    "https://srivardhaninfrainteriors-collab.github.io/vardhanproject/";
  const staticRoot = resolve(options.staticRoot || "dist");
  const base = options.base || process.env.SITE_BASE_PATH || "/vardhanproject/";
  const webhook = options.webhook ?? process.env.LEAD_WEBHOOK_URL;
  const webhookSecret = process.env.LEAD_WEBHOOK_SECRET;
  const adminOK = (req) => {
    if (!adminToken || adminToken.length < 32) return false;
    const given = String(req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );
    return timingSafeEqual(
      createHash("sha256").update(given).digest(),
      createHash("sha256").update(adminToken).digest(),
    );
  };
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  function limit(key, max, windowMs) {
    const now = Date.now();
    db.prepare("DELETE FROM rate_limits WHERE expires < ?").run(now);
    const row = db.prepare("SELECT * FROM rate_limits WHERE key=?").get(key);
    if (row && row.count >= max) return false;
    db.prepare(
      "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
    ).run(key, now + windowMs);
    return true;
  }
  async function notify(id, data) {
    if (!webhook) return;
    try {
      const target = new URL(webhook);
      if (target.protocol !== "https:") throw Error("Webhook must use HTTPS");
      const response = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(webhookSecret
            ? { Authorization: `Bearer ${webhookSecret}` }
            : {}),
        },
        body: JSON.stringify({ event: "lead.created", id, ...data }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw Error("Webhook failed");
      db.prepare("UPDATE leads SET notification_status=? WHERE id=?").run(
        "delivered",
        id,
      );
    } catch {
      db.prepare("UPDATE leads SET notification_status=? WHERE id=?").run(
        "failed",
        id,
      );
      console.error(
        "Lead saved; notification delivery failed for reference",
        id,
      );
    }
  }
  async function metaConversion(id, data, req) {
    if (
      !data.marketingConsent ||
      !process.env.META_PIXEL_ID ||
      !process.env.META_CAPI_TOKEN ||
      !process.env.META_GRAPH_VERSION
    )
      return;
    try {
      const response = await fetch(
        `https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${process.env.META_PIXEL_ID}/events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.META_CAPI_TOKEN}`,
          },
          body: JSON.stringify({
            data: [
              {
                event_name: "Lead",
                event_time: Math.floor(Date.now() / 1000),
                event_id: id,
                action_source: "website",
                event_source_url: new URL(
                  data.page.startsWith(base) ? data.page : base,
                  frontendOrigin,
                ).href,
                user_data: {
                  ph: [hash(data.phone.replace(/\D/g, ""))],
                  client_user_agent: req.headers["user-agent"] || "",
                },
              },
            ],
            ...(process.env.META_TEST_EVENT_CODE
              ? { test_event_code: process.env.META_TEST_EVENT_CODE }
              : {}),
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) throw Error("Meta delivery failed");
    } catch {
      console.error("Meta conversion delivery failed for reference", id);
    }
  }
  async function body(req) {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (Buffer.byteLength(text) > 12000)
        throw Object.assign(Error("Inquiry too large."), { status: 413 });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw Object.assign(Error("Invalid JSON."), { status: 400 });
    }
  }
  function json(res, status, data) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    const origin = req.headers.origin;
    const parsed = new URL(req.url, "http://localhost");
    const path = parsed.pathname;
    try {
      if (path.startsWith("/api/")) {
        if (origin && !origins.includes(origin)) {
          json(res, 403, { error: "Origin not allowed." });
          return;
        }
        if (origin) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Vary", "Origin");
        }
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET, POST, PATCH, DELETE, OPTIONS",
        );
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization",
        );
        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }
        if (path === "/api/health") {
          json(res, 200, { ok: true });
          return;
        }
        const address =
          process.env.TRUST_PROXY === "1"
            ? String(req.headers["x-forwarded-for"] || req.socket.remoteAddress)
                .split(",")[0]
                .trim()
            : req.socket.remoteAddress || "unknown";
        if (path === "/api/leads" && req.method === "POST") {
          if (
            !String(req.headers["content-type"]).startsWith("application/json")
          ) {
            json(res, 415, { error: "Use application/json." });
            return;
          }
          let data;
          try {
            data = validateLead(await body(req));
          } catch (err) {
            json(res, err.status || 400, { error: err.message });
            return;
          }
          const existing = db
            .prepare("SELECT id,payload FROM leads WHERE request_id=?")
            .get(data.requestId);
          if (existing) {
            const prior = JSON.parse(existing.payload);
            if (Object.keys(fields).some((key) => prior[key] !== data[key])) {
              json(res, 409, {
                error:
                  "An earlier version of this inquiry is already saved. Please call or WhatsApp the team to update its details.",
              });
              return;
            }
            json(res, 200, { id: existing.id, saved: true });
            return;
          }
          if (
            !limit(`ip:${hash(address)}`, 10, 3600000) ||
            !limit(`phone:${hash(data.phone.replace(/\D/g, ""))}`, 3, 3600000)
          ) {
            res.setHeader("Retry-After", "3600");
            json(res, 429, {
              error:
                "Too many inquiries. Please call the team or try again later.",
            });
            return;
          }
          const id = randomUUID();
          db.prepare(
            "INSERT INTO leads(id,request_id,created_at,status,payload,notification_status) VALUES(?,?,?,?,?,?)",
          ).run(
            id,
            data.requestId,
            new Date().toISOString(),
            "new",
            JSON.stringify(data),
            webhook ? "pending" : "not_configured",
          );
          json(res, 201, { id, saved: true });
          void notify(id, data);
          void metaConversion(id, data, req);
          return;
        }
        if (
          path === "/api/leads" ||
          /^\/api\/leads\/[0-9a-f-]{36}$/.test(path)
        ) {
          if (!limit(`admin:${hash(address)}`, 120, 60000)) {
            json(res, 429, { error: "Too many requests." });
            return;
          }
          if (!adminOK(req)) {
            json(res, 401, { error: "Authorised staff access is required." });
            return;
          }
          if (req.method === "GET" && path === "/api/leads") {
            const offset = Math.max(
              0,
              Math.min(
                10000000,
                Number.parseInt(parsed.searchParams.get("offset") || "0", 10) ||
                  0,
              ),
            );
            const rows = db
              .prepare(
                "SELECT * FROM leads ORDER BY created_at DESC LIMIT 100 OFFSET ?",
              )
              .all(offset);
            json(res, 200, {
              total: db.prepare("SELECT COUNT(*) AS count FROM leads").get()
                .count,
              offset,
              leads: rows.map((r) => ({
                ...JSON.parse(r.payload),
                id: r.id,
                created_at: r.created_at,
                status: r.status,
                notification_status: r.notification_status,
              })),
            });
            return;
          }
          const id = path.split("/").pop();
          if (!db.prepare("SELECT id FROM leads WHERE id=?").get(id)) {
            json(res, 404, { error: "Inquiry not found." });
            return;
          }
          if (req.method === "PATCH") {
            const input = await body(req);
            if (!statuses.includes(input.status)) {
              json(res, 400, { error: "Invalid lead status." });
              return;
            }
            db.prepare("UPDATE leads SET status=? WHERE id=?").run(
              input.status,
              id,
            );
            db.prepare(
              "INSERT INTO audit(lead_id,created_at,status) VALUES(?,?,?)",
            ).run(id, new Date().toISOString(), input.status);
            json(res, 200, { id, status: input.status });
            return;
          }
          if (req.method === "DELETE") {
            db.prepare("DELETE FROM audit WHERE lead_id=?").run(id);
            db.prepare("DELETE FROM leads WHERE id=?").run(id);
            json(res, 200, { deleted: true });
            return;
          }
        }
        json(res, 404, { error: "Endpoint not found." });
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405);
        res.end();
        return;
      }
      if (path === "/") {
        res.writeHead(302, { Location: base });
        res.end();
        return;
      }
      if (!path.startsWith(base)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const relative = decodeURIComponent(path.slice(base.length));
      let file = resolve(staticRoot, relative);
      if (file !== staticRoot && !file.startsWith(staticRoot + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        if (statSync(file).isDirectory()) file = resolve(file, "index.html");
        const buffer = readFileSync(file);
        const types = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".webp": "image/webp",
          ".png": "image/png",
          ".ttf": "font/ttf",
          ".woff2": "font/woff2",
          ".xml": "application/xml",
          ".txt": "text/plain",
        };
        res.writeHead(200, {
          "Content-Type": types[extname(file)] || "application/octet-stream",
          "Cache-Control": file.includes("/assets/")
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        });
        res.end(req.method === "HEAD" ? undefined : buffer);
      } catch {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        try {
          res.end(readFileSync(resolve(staticRoot, "404.html")));
        } catch {
          res.end("Not found");
        }
      }
    } catch (err) {
      if (!res.headersSent)
        json(res, err.status || 500, {
          error: err.status
            ? err.message
            : "We could not process the request. Please try again or contact the team.",
        });
      else res.end();
      console.error("Request failed:", err.name);
    }
  });
  server.on("close", () => db.close());
  return server;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.ADMIN_TOKEN ||
      process.env.ADMIN_TOKEN.length < 32 ||
      !process.env.ALLOWED_ORIGINS)
  ) {
    console.error(
      "Production requires ADMIN_TOKEN (32+ characters) and ALLOWED_ORIGINS.",
    );
    process.exit(1);
  }
  const server = createLeadServer();
  server.listen(
    Number(process.env.PORT || 8791),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `Lead service ready on port ${process.env.PORT || 8791}. Notifications: ${process.env.LEAD_WEBHOOK_URL ? "configured; delivery not yet verified" : "not configured"}.`,
      ),
  );
}
