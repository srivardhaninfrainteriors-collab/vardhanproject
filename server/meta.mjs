import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { text } from "./crm.mjs";
const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
const numeric = (v) => typeof v === "string" && /^\d{1,40}$/.test(v);
const time = () => new Date().toISOString();
const defaultMapping = {
  name: "full_name",
  phone: "phone_number",
  email: "email",
  location: "city",
  service: "service_requirement",
  property: "property_type",
  area: "approximate_area",
  budget: "project_budget",
  timeline: "project_timeline",
  message: "message",
  company: "company_name",
};
export function verifyMetaSignature(raw, signature, secret) {
  if (
    !secret ||
    typeof signature !== "string" ||
    !/^sha256=[0-9a-f]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export function createMeta({ db, crm, json, body, options = {} }) {
  const config = {
    appSecret: process.env.META_APP_SECRET,
    verifyToken: process.env.META_VERIFY_TOKEN,
    pageToken: process.env.META_PAGE_ACCESS_TOKEN,
    pageId: process.env.META_PAGE_ID,
    version: process.env.META_GRAPH_VERSION,
    ...options.meta,
  };
  const graphFetch = options.metaFetch || fetch;
  db.exec(`CREATE TABLE IF NOT EXISTS meta_forms(form_id TEXT PRIMARY KEY,label TEXT NOT NULL,mapping TEXT NOT NULL,defaults TEXT NOT NULL,owner_id TEXT,enabled INTEGER NOT NULL DEFAULT 1,backfill_cursor TEXT NOT NULL DEFAULT '',backfill_complete INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS meta_jobs(leadgen_id TEXT PRIMARY KEY,page_id TEXT NOT NULL,form_id TEXT NOT NULL,ad_id TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,last_error TEXT NOT NULL DEFAULT '',lead_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS meta_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  const state = (k, v) =>
    db
      .prepare(
        "INSERT INTO meta_state VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(k, String(v));
  let working = false,
    stopping = false;
  function configured() {
    return !!(
      config.appSecret &&
      config.verifyToken &&
      config.pageToken &&
      numeric(config.pageId) &&
      /^v\d+\.\d+$/.test(config.version || "")
    );
  }
  async function graph(path, params = {}) {
    if (!configured())
      fail("Meta credentials are not configured on the server.", 503);
    const endpoint = new URL(
      `https://graph.facebook.com/${config.version}/${path}`,
    );
    for (const [k, v] of Object.entries(params))
      endpoint.searchParams.set(k, String(v));
    endpoint.searchParams.set(
      "appsecret_proof",
      createHmac("sha256", config.appSecret)
        .update(config.pageToken)
        .digest("hex"),
    );
    const response = await graphFetch(endpoint.toString(), {
      headers: { Authorization: `Bearer ${config.pageToken}` },
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      const error = Error(
        `Meta request failed${data.error?.code ? ` (code ${Number(data.error.code)})` : ""}. Check permissions, token validity and Page access.`,
      );
      error.retryable =
        response.status === 429 ||
        response.status >= 500 ||
        [1, 2, 4, 17, 32, 613].includes(data.error?.code);
      throw error;
    }
    return data;
  }
  function enqueue(value, entryId) {
    const leadgenId = String(value.leadgen_id || ""),
      formId = String(value.form_id || ""),
      pageId = String(value.page_id || entryId || "");
    if (!numeric(leadgenId) || !numeric(formId) || pageId !== config.pageId)
      return false;
    const stamp = time();
    db.prepare(
      "INSERT OR IGNORE INTO meta_jobs(leadgen_id,page_id,form_id,ad_id,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    ).run(
      leadgenId,
      pageId,
      formId,
      String(value.ad_id || "").slice(0, 40),
      stamp,
      stamp,
    );
    return true;
  }
  function ingest(job, data) {
    const form = db
      .prepare("SELECT * FROM meta_forms WHERE form_id=? AND enabled=1")
      .get(job.form_id);
    if (!form)
      throw Object.assign(
        Error("Map and enable this Meta form before importing its leads."),
        { retryable: false },
      );
    if (
      String(data.id) !== job.leadgen_id ||
      (data.form_id && String(data.form_id) !== job.form_id)
    )
      throw Object.assign(
        Error(
          "Meta returned a lead or form ID that does not match the queued event.",
        ),
        { retryable: false },
      );
    if (!Array.isArray(data.field_data))
      throw Object.assign(Error("Meta did not return lead form answers."), {
        retryable: false,
      });
    const answers = Object.create(null);
    for (const f of data.field_data.slice(0, 100)) {
      if (typeof f.name === "string" && Array.isArray(f.values))
        answers[f.name.slice(0, 200)] = f.values
          .map((v) => String(v).slice(0, 4000))
          .join(", ")
          .slice(0, 4000);
    }
    const mapping = JSON.parse(form.mapping),
      defaults = JSON.parse(form.defaults);
    const payload = { ...defaults };
    for (const key of Object.keys(defaultMapping)) {
      const value = answers[mapping[key]];
      if (value !== undefined)
        payload[key] = value.slice(0, key === "message" ? 4000 : 200);
    }
    payload.name =
      payload.name ||
      [answers.first_name, answers.last_name].filter(Boolean).join(" ") ||
      "Meta inquiry";
    payload.consent = false;
    payload.marketingConsent = false;
    payload.analyticsConsent = false;
    payload.consentBasis =
      "Meta Instant Form submission. Review the form’s privacy notice and disclosed contact purposes before outreach.";
    payload.meta = {
      leadgen_id: job.leadgen_id,
      page_id: job.page_id,
      form_id: job.form_id,
      form_name: form.label,
      ad_id: String(data.ad_id || job.ad_id),
      created_time: data.created_time || "",
      answers,
      custom_disclaimer_responses: data.custom_disclaimer_responses || [],
    };
    payload.attribution = {
      utm_source: "meta",
      utm_medium: "lead_ad",
      form_id: job.form_id,
      ad_id: payload.meta.ad_id,
    };
    const existing = db
      .prepare("SELECT id FROM leads WHERE source='meta' AND source_id=?")
      .get(job.leadgen_id);
    if (existing) return existing.id;
    const id = randomUUID();
    const created = Number.isFinite(Date.parse(data.created_time))
      ? new Date(data.created_time).toISOString()
      : time();
    const owner =
      form.owner_id &&
      db
        .prepare("SELECT id FROM crm_users WHERE id=? AND active=1")
        .get(form.owner_id)
        ? form.owner_id
        : null;
    return crm.transaction(() => {
      db.prepare(
        "INSERT INTO leads(id,request_id,created_at,status,payload,source,source_id) VALUES(?,?,?,?,?,?,?)",
      ).run(
        id,
        `meta:${job.leadgen_id}`,
        created,
        "new",
        JSON.stringify(payload),
        "meta",
        job.leadgen_id,
      );
      crm.onLeadCreated(id, "meta", owner);
      return id;
    });
  }
  async function processJobs() {
    if (working || stopping || !configured()) return;
    working = true;
    try {
      const jobs = db
        .prepare(
          "SELECT * FROM meta_jobs WHERE status IN ('pending','retry') AND next_at<=? ORDER BY created_at LIMIT 10",
        )
        .all(Date.now());
      for (const job of jobs) {
        if (stopping) break;
        db.prepare(
          "UPDATE meta_jobs SET status='processing',attempts=attempts+1,updated_at=? WHERE leadgen_id=?",
        ).run(time(), job.leadgen_id);
        try {
          const form = db
            .prepare(
              "SELECT form_id FROM meta_forms WHERE form_id=? AND enabled=1",
            )
            .get(job.form_id);
          if (!form)
            throw Object.assign(
              Error("Map and enable this Meta form, then retry."),
              { retryable: false },
            );
          const data = await graph(job.leadgen_id, {
            fields:
              "id,created_time,ad_id,form_id,field_data,custom_disclaimer_responses",
          });
          const id = ingest(job, data);
          db.prepare(
            "UPDATE meta_jobs SET status='imported',lead_id=?,last_error='',updated_at=? WHERE leadgen_id=?",
          ).run(id, time(), job.leadgen_id);
          state("last_import", time());
        } catch (error) {
          const attempts = job.attempts + 1;
          const retry = error.retryable !== false && attempts < 6;
          db.prepare(
            "UPDATE meta_jobs SET status=?,next_at=?,last_error=?,updated_at=? WHERE leadgen_id=?",
          ).run(
            retry ? "retry" : "failed",
            Date.now() + Math.min(3600000, 30000 * 2 ** (attempts - 1)),
            error.message.startsWith("Meta") || error.message.startsWith("Map")
              ? error.message
              : "Lead import failed. Check integration configuration and retry.",
            time(),
            job.leadgen_id,
          );
        }
      }
    } finally {
      working = false;
    }
  }
  // ponytail: one Node process owns this durable queue; use shared job leases before running multiple instances.
  db.prepare(
    "UPDATE meta_jobs SET status='retry' WHERE status='processing'",
  ).run();
  async function webhook(req, res, parsed) {
    if (parsed.pathname !== "/api/meta/webhook") return false;
    if (req.method === "GET") {
      if (
        config.verifyToken &&
        parsed.searchParams.get("hub.mode") === "subscribe" &&
        parsed.searchParams.get("hub.verify_token") === config.verifyToken
      ) {
        state("verified_at", time());
        res.writeHead(200, {
          "Content-Type": "text/plain",
          "Cache-Control": "no-store",
        });
        res.end(
          (parsed.searchParams.get("hub.challenge") || "").slice(0, 1000),
        );
      } else json(res, 403, { error: "Webhook verification failed." });
      return true;
    }
    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed." });
      return true;
    }
    if (!configured()) {
      json(res, 503, { error: "Meta integration is not configured." });
      return true;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 256000) fail("Webhook body too large.", 413);
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks);
    if (
      !verifyMetaSignature(
        raw,
        req.headers["x-hub-signature-256"],
        config.appSecret,
      )
    ) {
      json(res, 401, { error: "Invalid webhook signature." });
      return true;
    }
    let event;
    try {
      event = JSON.parse(raw.toString("utf8"));
    } catch {
      fail("Malformed webhook payload.");
    }
    if (!event || event.object !== "page" || !Array.isArray(event.entry))
      fail("Expected a Page webhook.");
    let queued = 0;
    crm.transaction(() => {
      for (const entry of event.entry.slice(0, 100))
        for (const change of (Array.isArray(entry?.changes)
          ? entry.changes
          : []
        ).slice(0, 100))
          if (
            change?.field === "leadgen" &&
            change.value &&
            enqueue(change.value, String(entry.id))
          )
            queued++;
      state("last_webhook", time());
    });
    json(res, 200, { received: true, accepted: queued });
    void processJobs();
    return true;
  }
  async function handleAdmin(req, res, route, parsed, user) {
    if (route === "/meta" && req.method === "GET") {
      const flags = {
        appSecret: !!config.appSecret,
        verifyToken: !!config.verifyToken,
        pageToken: !!config.pageToken,
        pageId: !!config.pageId,
        graphVersion: !!config.version,
      };
      const forms = db
        .prepare("SELECT * FROM meta_forms ORDER BY label")
        .all()
        .map((f) => ({
          ...f,
          mapping: JSON.parse(f.mapping),
          defaults: JSON.parse(f.defaults),
        }));
      json(res, 200, {
        configured: configured(),
        flags,
        pageId: config.pageId || "",
        graphVersion: config.version || "",
        webhookPath: "/api/meta/webhook",
        state: Object.fromEntries(
          db
            .prepare("SELECT * FROM meta_state")
            .all()
            .map((s) => [s.key, s.value]),
        ),
        forms,
        defaultMapping,
        jobs: db
          .prepare("SELECT * FROM meta_jobs ORDER BY updated_at DESC LIMIT 100")
          .all(),
        counts: db
          .prepare(
            "SELECT status,COUNT(*) count FROM meta_jobs GROUP BY status",
          )
          .all(),
      });
      return true;
    }
    if (route === "/meta/test" && req.method === "POST") {
      const data = await graph(config.pageId, { fields: "id,name" });
      state("connection_checked_at", time());
      state("page_name", data.name || data.id);
      json(res, 200, {
        ok: true,
        page: { id: data.id, name: data.name },
        note: "Page access verified. Verify lead retrieval separately with a Meta test lead.",
      });
      return true;
    }
    if (route === "/meta/forms" && req.method === "POST") {
      const input = await body(req);
      const formId = text(input.form_id, 40, true);
      if (!numeric(formId)) fail("Enter a numeric Meta form ID.");
      const label = text(input.label, 150, true),
        mapping = {},
        defaults = {};
      for (const key of Object.keys(defaultMapping)) {
        mapping[key] = text(input.mapping?.[key] ?? defaultMapping[key], 200);
        if (["service", "location", "property"].includes(key))
          defaults[key] = text(input.defaults?.[key], 200);
      }
      const ownerId = input.owner_id || null;
      if (
        ownerId &&
        !db
          .prepare("SELECT id FROM crm_users WHERE id=? AND active=1")
          .get(ownerId)
      )
        fail("Choose an active owner.");
      if (mapping.name && !/^[\w .-]+$/.test(mapping.name))
        fail("Use the field name returned by Meta.");
      db.prepare(
        "INSERT INTO meta_forms(form_id,label,mapping,defaults,owner_id,enabled) VALUES(?,?,?,?,?,?) ON CONFLICT(form_id) DO UPDATE SET label=excluded.label,mapping=excluded.mapping,defaults=excluded.defaults,owner_id=excluded.owner_id,enabled=excluded.enabled",
      ).run(
        formId,
        label,
        JSON.stringify(mapping),
        JSON.stringify(defaults),
        ownerId,
        input.enabled === false ? 0 : 1,
      );
      crm.record(
        null,
        "integration",
        `Updated Meta form mapping ${formId}`,
        user.id,
      );
      json(res, 200, { ok: true });
      return true;
    }
    if (route === "/meta/retry" && req.method === "POST") {
      const input = await body(req);
      if (!numeric(input.leadgen_id)) fail("Invalid Meta lead ID.");
      const result = db
        .prepare(
          "UPDATE meta_jobs SET status='retry',attempts=0,next_at=0 WHERE leadgen_id=? AND status IN ('failed','retry')",
        )
        .run(input.leadgen_id);
      if (!result.changes)
        fail("Only failed or pending-retry jobs can be retried.");
      void processJobs();
      json(res, 202, { queued: true });
      return true;
    }
    if (route === "/meta/backfill" && req.method === "POST") {
      const input = await body(req);
      const form = db
        .prepare("SELECT * FROM meta_forms WHERE form_id=? AND enabled=1")
        .get(text(input.form_id, 40, true));
      if (!form) fail("Map and enable the form first.");
      const cursor = input.restart ? "" : form.backfill_cursor;
      if (form.backfill_complete && !input.restart) {
        json(res, 200, { queued: 0, complete: true });
        return true;
      }
      const data = await graph(`${form.form_id}/leads`, {
        fields: "id",
        limit: 100,
        ...(cursor ? { after: cursor } : {}),
      });
      if (!Array.isArray(data.data))
        fail("Meta did not return a lead list.", 502);
      let queued = 0;
      crm.transaction(() => {
        for (const entry of data.data)
          if (
            enqueue(
              {
                leadgen_id: String(entry.id),
                form_id: form.form_id,
                page_id: config.pageId,
              },
              config.pageId,
            )
          )
            queued++;
        const next = data.paging?.next ? data.paging?.cursors?.after || "" : "";
        if (data.paging?.next && !next)
          fail("Meta returned pagination without a cursor.", 502);
        db.prepare(
          "UPDATE meta_forms SET backfill_cursor=?,backfill_complete=? WHERE form_id=?",
        ).run(next, next ? 0 : 1, form.form_id);
      });
      void processJobs();
      json(res, 202, { queued, complete: !data.paging?.next });
      return true;
    }
    json(res, 404, { error: "Meta integration endpoint not found." });
    return true;
  }
  let timer;
  return {
    webhook,
    handleAdmin,
    processJobs,
    start() {
      timer = setInterval(() => void processJobs(), 15000);
      timer.unref();
      void processJobs();
    },
    async stop() {
      stopping = true;
      clearInterval(timer);
      while (working) await new Promise((r) => setTimeout(r, 20));
    },
  };
}
