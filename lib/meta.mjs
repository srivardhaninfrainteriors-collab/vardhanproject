import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { getDb } from "./mongo.mjs";
import { text, fail, record, onLeadCreated } from "./crm.mjs";

const numeric = (v) => typeof v === "string" && /^\d{1,40}$/.test(v);
const time = () => new Date().toISOString();

export const defaultMapping = {
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
  if (!secret || typeof signature !== "string" || !/^sha256=[0-9a-f]{64}$/.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const given = Buffer.from(signature.slice(7), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function config() {
  return {
    appSecret: process.env.META_APP_SECRET,
    verifyToken: process.env.META_VERIFY_TOKEN,
    pageToken: process.env.META_PAGE_ACCESS_TOKEN,
    pageId: process.env.META_PAGE_ID,
    version: process.env.META_GRAPH_VERSION,
  };
}

export function configured() {
  const c = config();
  return !!(
    c.appSecret &&
    c.verifyToken &&
    c.pageToken &&
    numeric(c.pageId) &&
    /^v\d+\.\d+$/.test(c.version || "")
  );
}

async function state(key, value) {
  const db = await getDb();
  await db.collection("meta_state").updateOne({ _id: key }, { $set: { value: String(value) } }, { upsert: true });
}

let ready;
export function ensureMetaSchema() {
  if (!ready)
    ready = (async () => {
      const db = await getDb();
      await db.collection("meta_jobs").updateMany(
        { status: "processing" },
        { $set: { status: "retry" } },
      );
    })();
  return ready;
}

async function graph(path, params = {}) {
  const c = config();
  if (!configured()) fail("Meta credentials are not configured on the server.", 503);
  const endpoint = new URL(`https://graph.facebook.com/${c.version}/${path}`);
  for (const [k, v] of Object.entries(params)) endpoint.searchParams.set(k, String(v));
  endpoint.searchParams.set(
    "appsecret_proof",
    createHmac("sha256", c.appSecret).update(c.pageToken).digest("hex"),
  );
  const response = await fetch(endpoint.toString(), {
    headers: { Authorization: `Bearer ${c.pageToken}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    const error = Error(
      `Meta request failed${data.error?.code ? ` (code ${Number(data.error.code)})` : ""}. Check permissions, token validity and Page access.`,
    );
    error.retryable =
      response.status === 429 || response.status >= 500 || [1, 2, 4, 17, 32, 613].includes(data.error?.code);
    throw error;
  }
  return data;
}

async function enqueue(value, entryId) {
  const c = config();
  const leadgenId = String(value.leadgen_id || ""),
    formId = String(value.form_id || ""),
    pageId = String(value.page_id || entryId || "");
  if (!numeric(leadgenId) || !numeric(formId) || pageId !== c.pageId) return false;
  const db = await getDb();
  const stamp = time();
  try {
    await db.collection("meta_jobs").insertOne({
      _id: leadgenId,
      page_id: pageId,
      form_id: formId,
      ad_id: String(value.ad_id || "").slice(0, 40),
      status: "pending",
      attempts: 0,
      next_at: 0,
      last_error: "",
      lead_id: null,
      created_at: stamp,
      updated_at: stamp,
    });
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
  return true;
}

async function ingest(db, job, data) {
  const form = await db.collection("meta_forms").findOne({ _id: job.form_id, enabled: 1 });
  if (!form)
    throw Object.assign(Error("Map and enable this Meta form before importing its leads."), { retryable: false });
  if (String(data.id) !== job.leadgen_id || (data.form_id && String(data.form_id) !== job.form_id))
    throw Object.assign(
      Error("Meta returned a lead or form ID that does not match the queued event."),
      { retryable: false },
    );
  if (!Array.isArray(data.field_data))
    throw Object.assign(Error("Meta did not return lead form answers."), { retryable: false });
  const answers = Object.create(null);
  for (const f of data.field_data.slice(0, 100))
    if (typeof f.name === "string" && Array.isArray(f.values))
      answers[f.name.slice(0, 200)] = f.values.map((v) => String(v).slice(0, 4000)).join(", ").slice(0, 4000);
  const { mapping, defaults } = form;
  const payload = { ...defaults };
  for (const key of Object.keys(defaultMapping)) {
    const value = answers[mapping[key]];
    if (value !== undefined) payload[key] = value.slice(0, key === "message" ? 4000 : 200);
  }
  payload.name =
    payload.name || [answers.first_name, answers.last_name].filter(Boolean).join(" ") || "Meta inquiry";
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
  const existing = await db.collection("leads").findOne({ source: "meta", source_id: job.leadgen_id });
  if (existing) return existing._id;
  const id = randomUUID();
  const created = Number.isFinite(Date.parse(data.created_time)) ? new Date(data.created_time).toISOString() : time();
  const ownerUser =
    form.owner_id && (await db.collection("crm_users").findOne({ _id: form.owner_id, active: 1 }));
  const owner = ownerUser ? form.owner_id : null;
  await db.collection("leads").insertOne({
    _id: id,
    request_id: `meta:${job.leadgen_id}`,
    created_at: created,
    status: "new",
    payload,
    source: "meta",
    source_id: job.leadgen_id,
  });
  await onLeadCreated(id, "meta", owner);
  return id;
}

export async function processJobs() {
  const db = await getDb();
  if (!configured()) return;
  const jobs = await db
    .collection("meta_jobs")
    .find({ status: { $in: ["pending", "retry"] }, next_at: { $lte: Date.now() } })
    .sort({ created_at: 1 })
    .limit(10)
    .toArray();
  for (const job of jobs) {
    await db
      .collection("meta_jobs")
      .updateOne({ _id: job._id }, { $set: { status: "processing", updated_at: time() }, $inc: { attempts: 1 } });
    try {
      const form = await db.collection("meta_forms").findOne({ _id: job.form_id, enabled: 1 });
      if (!form) throw Object.assign(Error("Map and enable this Meta form, then retry."), { retryable: false });
      const data = await graph(job.leadgen_id, {
        fields: "id,created_time,ad_id,form_id,field_data,custom_disclaimer_responses",
      });
      const id = await ingest(db, job, data);
      await db
        .collection("meta_jobs")
        .updateOne({ _id: job._id }, { $set: { status: "imported", lead_id: id, last_error: "", updated_at: time() } });
      await state("last_import", time());
    } catch (error) {
      const attempts = job.attempts + 1;
      const retry = error.retryable !== false && attempts < 6;
      await db.collection("meta_jobs").updateOne(
        { _id: job._id },
        {
          $set: {
            status: retry ? "retry" : "failed",
            next_at: Date.now() + Math.min(3600000, 30000 * 2 ** (attempts - 1)),
            last_error:
              error.message.startsWith("Meta") || error.message.startsWith("Map")
                ? error.message
                : "Lead import failed. Check integration configuration and retry.",
            updated_at: time(),
          },
        },
      );
    }
  }
}

export async function handleWebhookGet(req, res, parsed) {
  const c = config();
  if (
    c.verifyToken &&
    parsed.searchParams.get("hub.mode") === "subscribe" &&
    parsed.searchParams.get("hub.verify_token") === c.verifyToken
  ) {
    await state("verified_at", time());
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send((parsed.searchParams.get("hub.challenge") || "").slice(0, 1000));
  } else {
    res.status(403).json({ error: "Webhook verification failed." });
  }
}

export async function handleWebhookPost(req, res, rawBody) {
  const c = config();
  if (!configured()) {
    res.status(503).json({ error: "Meta integration is not configured." });
    return;
  }
  if (!verifyMetaSignature(rawBody, req.headers["x-hub-signature-256"], c.appSecret)) {
    res.status(401).json({ error: "Invalid webhook signature." });
    return;
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    fail("Malformed webhook payload.");
  }
  if (!event || event.object !== "page" || !Array.isArray(event.entry)) fail("Expected a Page webhook.");
  let queued = 0;
  for (const entry of event.entry.slice(0, 100))
    for (const change of (Array.isArray(entry?.changes) ? entry.changes : []).slice(0, 100))
      if (change?.field === "leadgen" && change.value && (await enqueue(change.value, String(entry.id)))) queued++;
  await state("last_webhook", time());
  res.status(200).json({ received: true, accepted: queued });
  await processJobs();
}

export async function handleMetaAdmin(action, req, res, user) {
  const db = await getDb();
  if (action === "status" && req.method === "GET") {
    const c = config();
    const flags = {
      appSecret: !!c.appSecret,
      verifyToken: !!c.verifyToken,
      pageToken: !!c.pageToken,
      pageId: !!c.pageId,
      graphVersion: !!c.version,
    };
    const forms = await db.collection("meta_forms").find({}).sort({ label: 1 }).toArray();
    const stateRows = await db.collection("meta_state").find({}).toArray();
    const jobs = await db.collection("meta_jobs").find({}).sort({ updated_at: -1 }).limit(100).toArray();
    const counts = await db
      .collection("meta_jobs")
      .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
      .toArray();
    res.status(200).json({
      configured: configured(),
      flags,
      pageId: c.pageId || "",
      graphVersion: c.version || "",
      webhookPath: "/api/meta/webhook",
      state: Object.fromEntries(stateRows.map((s) => [s._id, s.value])),
      forms: forms.map((f) => ({ ...f, id: f._id })),
      defaultMapping,
      jobs: jobs.map((j) => ({ ...j, leadgen_id: j._id })),
      counts: counts.map((c2) => ({ status: c2._id, count: c2.count })),
    });
    return;
  }
  if (action === "test" && req.method === "POST") {
    const c = config();
    const data = await graph(c.pageId, { fields: "id,name" });
    await state("connection_checked_at", time());
    await state("page_name", data.name || data.id);
    res.status(200).json({
      ok: true,
      page: { id: data.id, name: data.name },
      note: "Page access verified. Verify lead retrieval separately with a Meta test lead.",
    });
    return;
  }
  if (action === "forms" && req.method === "POST") {
    const input = req.body || {};
    const formId = text(input.form_id, 40, true);
    if (!numeric(formId)) fail("Enter a numeric Meta form ID.");
    const label = text(input.label, 150, true),
      mapping = {},
      defaults = {};
    for (const key of Object.keys(defaultMapping)) {
      mapping[key] = text(input.mapping?.[key] ?? defaultMapping[key], 200);
      if (["service", "location", "property"].includes(key)) defaults[key] = text(input.defaults?.[key], 200);
    }
    const ownerId = input.owner_id || null;
    if (ownerId && !(await db.collection("crm_users").findOne({ _id: ownerId, active: 1 })))
      fail("Choose an active owner.");
    if (mapping.name && !/^[\w .-]+$/.test(mapping.name)) fail("Use the field name returned by Meta.");
    await db.collection("meta_forms").updateOne(
      { _id: formId },
      {
        $set: {
          label,
          mapping,
          defaults,
          owner_id: ownerId,
          enabled: input.enabled === false ? 0 : 1,
        },
        $setOnInsert: { backfill_cursor: "", backfill_complete: 0 },
      },
      { upsert: true },
    );
    await record(null, "integration", `Updated Meta form mapping ${formId}`, user.id);
    res.status(200).json({ ok: true });
    return;
  }
  if (action === "retry" && req.method === "POST") {
    const input = req.body || {};
    if (!numeric(input.leadgen_id)) fail("Invalid Meta lead ID.");
    const result = await db
      .collection("meta_jobs")
      .updateOne(
        { _id: input.leadgen_id, status: { $in: ["failed", "retry"] } },
        { $set: { status: "retry", attempts: 0, next_at: 0 } },
      );
    if (!result.matchedCount) fail("Only failed or pending-retry jobs can be retried.");
    await processJobs();
    res.status(202).json({ queued: true });
    return;
  }
  if (action === "backfill" && req.method === "POST") {
    const input = req.body || {};
    const form = await db.collection("meta_forms").findOne({ _id: text(input.form_id, 40, true), enabled: 1 });
    if (!form) fail("Map and enable the form first.");
    const cursor = input.restart ? "" : form.backfill_cursor;
    if (form.backfill_complete && !input.restart) {
      res.status(200).json({ queued: 0, complete: true });
      return;
    }
    const c = config();
    const data = await graph(`${form._id}/leads`, {
      fields: "id",
      limit: 100,
      ...(cursor ? { after: cursor } : {}),
    });
    if (!Array.isArray(data.data)) fail("Meta did not return a lead list.", 502);
    let queued = 0;
    for (const entry of data.data)
      if (
        await enqueue({ leadgen_id: String(entry.id), form_id: form._id, page_id: c.pageId }, c.pageId)
      )
        queued++;
    const next = data.paging?.next ? data.paging?.cursors?.after || "" : "";
    if (data.paging?.next && !next) fail("Meta returned pagination without a cursor.", 502);
    await db
      .collection("meta_forms")
      .updateOne({ _id: form._id }, { $set: { backfill_cursor: next, backfill_complete: next ? 0 : 1 } });
    await processJobs();
    res.status(202).json({ queued, complete: !data.paging?.next });
    return;
  }
  res.status(404).json({ error: "Meta integration endpoint not found." });
}
