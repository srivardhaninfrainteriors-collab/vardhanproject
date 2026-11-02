import {
  createHmac,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
  randomUUID,
  randomBytes,
} from "node:crypto";
import { getDb } from "./mongo.mjs";
import { text, fail, record, onLeadCreated } from "./crm.mjs";

const numeric = (v) => typeof v === "string" && /^\d{1,40}$/.test(v);
const time = () => new Date().toISOString();
const GRAPH = "https://graph.facebook.com";
const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_manage_ads",
  "leads_retrieval",
  "business_management",
];

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

// Custom Instant Form questions get generated keys (e.g. "what_is_your_budget?").
// These patterns route them to CRM fields when no explicit mapping exists.
const guesses = [
  ["name", /^(full_?name|name)$/],
  ["phone", /phone|mobile|whatsapp|contact_?number/],
  ["email", /e-?mail/],
  ["location", /^city$|location|area_?of_?residence|where.*(live|located)|^state$/],
  ["service", /service|requirement|interest|looking_?for|need/],
  ["property", /property|home_?type|bhk|space_?type/],
  ["area", /sq|square|carpet|size_?of/],
  ["budget", /budget|price_?range|invest/],
  ["timeline", /timeline|when|start|move_?in|possession/],
  ["company", /company|business|organi[sz]ation/],
  ["message", /message|comment|notes|details|anything_?else/],
];

export function autoMapping(keys = []) {
  const mapping = { ...defaultMapping };
  const used = new Set();
  for (const [field, pattern] of guesses) {
    if (keys.includes(mapping[field])) {
      used.add(mapping[field]);
      continue;
    }
    const hit = keys.find((k) => !used.has(k) && pattern.test(k.toLowerCase()));
    if (hit) {
      mapping[field] = hit;
      used.add(hit);
    }
  }
  return mapping;
}

export function verifyMetaSignature(raw, signature, secret) {
  if (!secret || typeof signature !== "string" || !/^sha256=[0-9a-f]{64}$/.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const given = Buffer.from(signature.slice(7), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ---- Encrypted storage for the Page token obtained through "Connect Facebook" ----
const key = (secret) => createHash("sha256").update(`${secret}:srivardhan-meta-token`).digest();
function seal(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}
function open(sealed, secret) {
  try {
    const [iv, tag, body] = sealed.split(".").map((b) => Buffer.from(b, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

async function config() {
  const appSecret = process.env.META_APP_SECRET || "";
  const db = await getDb();
  const saved = (await db.collection("meta_state").findOne({ _id: "connection" })) || {};
  const envPage = numeric(process.env.META_PAGE_ID || "") && process.env.META_PAGE_ACCESS_TOKEN;
  return {
    appId: process.env.META_APP_ID || "",
    appSecret,
    loginConfigId: process.env.META_LOGIN_CONFIG_ID || "",
    verifyToken:
      process.env.META_VERIFY_TOKEN ||
      (appSecret
        ? createHmac("sha256", appSecret).update("srivardhan:webhook-verify").digest("hex").slice(0, 40)
        : ""),
    pageToken: envPage
      ? process.env.META_PAGE_ACCESS_TOKEN
      : saved.token && appSecret
        ? open(saved.token, appSecret)
        : "",
    pageId: envPage ? process.env.META_PAGE_ID : saved.page_id || "",
    pageName: envPage ? "" : saved.page_name || "",
    connectedAt: saved.connected_at || "",
    connectedBy: saved.connected_by || "",
    source: envPage ? "environment" : saved.page_id ? "facebook-login" : "",
    version: /^v\d+\.\d+$/.test(process.env.META_GRAPH_VERSION || "")
      ? process.env.META_GRAPH_VERSION
      : "v24.0",
  };
}

const ready_ = (c) => !!(c.appSecret && c.pageToken && numeric(c.pageId));
export async function configured() {
  return ready_(await config());
}

async function state(k, value) {
  const db = await getDb();
  await db.collection("meta_state").updateOne({ _id: k }, { $set: { value: String(value) } }, { upsert: true });
}

let ready;
export function ensureMetaSchema() {
  if (!ready)
    ready = (async () => {
      const db = await getDb();
      await db.collection("meta_jobs").updateMany({ status: "processing" }, { $set: { status: "retry" } });
    })().catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

function metaError(data, status) {
  const error = Error(
    `Meta request failed${data?.error?.code ? ` (code ${Number(data.error.code)})` : ""}${
      data?.error?.message ? `: ${String(data.error.message).replace(/access_token=\S+/g, "").slice(0, 220)}` : ""
    }`,
  );
  error.status = 502;
  error.code = data?.error?.code;
  error.retryable = status === 429 || status >= 500 || [1, 2, 4, 17, 32, 613].includes(data?.error?.code);
  return error;
}

async function call(method, c, path, params = {}, token = c.pageToken) {
  const endpoint = new URL(`${GRAPH}/${c.version}/${path}`);
  const body = new URLSearchParams();
  const target = method === "GET" ? endpoint.searchParams : body;
  for (const [k, v] of Object.entries(params)) target.set(k, String(v));
  if (token && c.appSecret && !String(token).includes("|"))
    target.set("appsecret_proof", createHmac("sha256", c.appSecret).update(token).digest("hex"));
  if (token) target.set("access_token", token);
  const response = await fetch(endpoint.toString(), {
    method,
    ...(method === "GET" ? {} : { body, headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
    signal: AbortSignal.timeout(15000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok || data.error) throw metaError(data, response.status);
  return data;
}

async function graph(path, params = {}) {
  const c = await config();
  if (!ready_(c)) fail("Facebook is not connected yet. Use “Connect Facebook” in Meta setup.", 503);
  return call("GET", c, path, params);
}

async function enqueue(value, entryId, c) {
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
      adgroup_id: String(value.adgroup_id || "").slice(0, 40),
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
    return false;
  }
  return true;
}

// Unknown forms are registered automatically with smart field mapping so that
// every Meta lead reaches the CRM without manual setup. Paused forms stay paused.
async function formFor(db, formId, answerKeys = []) {
  let form = await db.collection("meta_forms").findOne({ _id: formId });
  if (form) return form.enabled ? form : null;
  let label = `Instant Form ${formId}`;
  try {
    const info = await graph(formId, { fields: "id,name" });
    if (info.name) label = String(info.name).slice(0, 150);
  } catch {}
  form = {
    _id: formId,
    label,
    mapping: autoMapping(answerKeys),
    defaults: {},
    owner_id: null,
    enabled: 1,
    auto: 1,
    backfill_cursor: "",
    backfill_complete: 0,
  };
  await db.collection("meta_forms").updateOne({ _id: formId }, { $setOnInsert: form }, { upsert: true });
  return db.collection("meta_forms").findOne({ _id: formId, enabled: 1 });
}

async function adNames(adId) {
  if (!numeric(adId)) return {};
  try {
    const ad = await graph(adId, { fields: "name,adset{name},campaign{name}" });
    return {
      ad_name: String(ad.name || "").slice(0, 200),
      adset_name: String(ad.adset?.name || "").slice(0, 200),
      campaign_name: String(ad.campaign?.name || "").slice(0, 200),
    };
  } catch {
    return {};
  }
}

async function ingest(db, job, data) {
  if (String(data.id) !== job.leadgen_id || (data.form_id && String(data.form_id) !== job.form_id))
    throw Object.assign(Error("Meta returned a lead or form ID that does not match the queued event."), {
      retryable: false,
    });
  if (!Array.isArray(data.field_data))
    throw Object.assign(Error("Meta did not return lead form answers."), { retryable: false });
  const answers = Object.create(null);
  for (const f of data.field_data.slice(0, 100))
    if (typeof f.name === "string" && Array.isArray(f.values))
      answers[f.name.slice(0, 200)] = f.values.map((v) => String(v).slice(0, 4000)).join(", ").slice(0, 4000);
  const form = await formFor(db, job.form_id, Object.keys(answers));
  if (!form)
    throw Object.assign(Error("This Meta form is paused in Meta setup. Enable it, then retry."), {
      retryable: false,
    });
  const mapping = { ...autoMapping(Object.keys(answers)), ...Object.fromEntries(Object.entries(form.mapping || {}).filter(([, v]) => v && answers[v] !== undefined)) };
  const payload = { ...(form.defaults || {}) };
  for (const k of Object.keys(payload)) if (!payload[k]) delete payload[k];
  for (const k of Object.keys(defaultMapping)) {
    const value = answers[mapping[k]];
    if (value !== undefined && value !== "") payload[k] = value.slice(0, k === "message" ? 4000 : 200);
  }
  payload.name =
    payload.name || [answers.first_name, answers.last_name].filter(Boolean).join(" ") || "Meta inquiry";
  if (payload.phone) payload.phone = payload.phone.replace(/[^+0-9 ()-]/g, "").slice(0, 30);
  payload.consent = false;
  payload.marketingConsent = false;
  payload.analyticsConsent = false;
  payload.consentBasis =
    "Meta Instant Form submission. Review the form’s privacy notice and disclosed contact purposes before outreach.";
  const adId = String(data.ad_id || job.ad_id || "");
  payload.meta = {
    leadgen_id: job.leadgen_id,
    page_id: job.page_id,
    form_id: job.form_id,
    form_name: form.label,
    ad_id: adId,
    ...(await adNames(adId)),
    platform: String(data.platform || "").slice(0, 20),
    is_organic: !!data.is_organic,
    created_time: data.created_time || "",
    answers,
    custom_disclaimer_responses: data.custom_disclaimer_responses || [],
  };
  payload.attribution = {
    utm_source: "meta",
    utm_medium: "lead_ad",
    utm_campaign: payload.meta.campaign_name || "",
    form_id: job.form_id,
    ad_id: adId,
  };
  const existing = await db.collection("leads").findOne({ source: "meta", source_id: job.leadgen_id });
  if (existing) return existing._id;
  const id = randomUUID();
  const created = Number.isFinite(Date.parse(data.created_time)) ? new Date(data.created_time).toISOString() : time();
  const ownerUser = form.owner_id && (await db.collection("crm_users").findOne({ _id: form.owner_id, active: 1 }));
  const owner = ownerUser ? form.owner_id : null;
  await db.collection("leads").insertOne({
    _id: id,
    request_id: `meta:${job.leadgen_id}`,
    created_at: created,
    status: "new",
    payload,
    source: "meta",
    source_id: job.leadgen_id,
    priority: "normal",
    deal_value: 0,
    expected_close: "",
    archived: 0,
    version: 1,
    owner_id: owner,
  });
  await onLeadCreated(id, "meta", owner);
  return id;
}

export async function processJobs(max = 10) {
  const db = await getDb();
  if (!(await configured())) return 0;
  const jobs = await db
    .collection("meta_jobs")
    .find({ status: { $in: ["pending", "retry"] }, next_at: { $lte: Date.now() } })
    .sort({ created_at: 1 })
    .limit(max)
    .toArray();
  let imported = 0;
  for (const job of jobs) {
    await db
      .collection("meta_jobs")
      .updateOne({ _id: job._id }, { $set: { status: "processing", updated_at: time() }, $inc: { attempts: 1 } });
    try {
      const data = await graph(job.leadgen_id, {
        fields: "id,created_time,ad_id,form_id,field_data,custom_disclaimer_responses,platform,is_organic",
      });
      const id = await ingest(db, job, data);
      await db
        .collection("meta_jobs")
        .updateOne({ _id: job._id }, { $set: { status: "imported", lead_id: id, last_error: "", updated_at: time() } });
      await state("last_import", time());
      imported++;
    } catch (error) {
      const attempts = job.attempts + 1;
      const retry = error.retryable !== false && attempts < 6;
      await db.collection("meta_jobs").updateOne(
        { _id: job._id },
        {
          $set: {
            status: retry ? "retry" : "failed",
            next_at: Date.now() + Math.min(3600000, 30000 * 2 ** (attempts - 1)),
            last_error: /^(Meta|This Meta|Facebook)/.test(error.message)
              ? error.message
              : "Lead import failed. Check the Facebook connection and retry.",
            updated_at: time(),
          },
        },
      );
    }
  }
  return imported;
}

export async function handleWebhookGet(req, res, parsed) {
  const c = await config();
  const given = parsed.searchParams.get("hub.verify_token") || "";
  if (
    c.verifyToken &&
    parsed.searchParams.get("hub.mode") === "subscribe" &&
    given.length === c.verifyToken.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(c.verifyToken))
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
  const c = await config();
  if (!c.appSecret) {
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
      if (change?.field === "leadgen" && change.value && (await enqueue(change.value, String(entry.id), c))) queued++;
  await state("last_webhook", time());
  // Serverless functions may be frozen after responding, so import before acknowledging.
  try {
    await processJobs(Math.max(10, queued));
  } catch (e) {
    console.error("Meta import after webhook failed:", e.message);
  }
  res.status(200).json({ received: true, accepted: queued });
}

function origin(req) {
  if (process.env.META_REDIRECT_ORIGIN) return process.env.META_REDIRECT_ORIGIN.replace(/\/$/, "");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) fail("Unrecognised host.");
  const proto = /^(localhost|127\.0\.0\.1)/.test(host) ? "http" : "https";
  return `${proto}://${host}`;
}
const crmUrl = (req, status) => `${origin(req)}/crm/?meta=${encodeURIComponent(status)}`;

async function syncForms(c) {
  const db = await getDb();
  const data = await call("GET", c, `${c.pageId}/leadgen_forms`, {
    fields: "id,name,status,questions{key,type}",
    limit: 100,
  });
  let added = 0;
  for (const f of data.data || []) {
    if (!numeric(String(f.id))) continue;
    const keys = (f.questions || []).map((q) => String(q.key || q.type || "").toLowerCase()).filter(Boolean);
    const result = await db.collection("meta_forms").updateOne(
      { _id: String(f.id) },
      {
        $set: { label: String(f.name || `Instant Form ${f.id}`).slice(0, 150), meta_status: String(f.status || "") },
        $setOnInsert: {
          mapping: autoMapping(keys),
          defaults: {},
          owner_id: null,
          enabled: 1,
          auto: 1,
          backfill_cursor: "",
          backfill_complete: 0,
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount) added++;
  }
  await state("forms_synced_at", time());
  return { total: (data.data || []).length, added };
}

// Subscribes the Page to this app and registers the app-level webhook so that
// Meta pushes every new lead to /api/meta/webhook. Safe to repeat.
async function wire(req, c) {
  const steps = {};
  try {
    await call("POST", c, `${c.pageId}/subscribed_apps`, { subscribed_fields: "leadgen" });
    steps.page = "subscribed";
    await state("page_subscribed_at", time());
  } catch (e) {
    steps.page = e.message;
  }
  if (c.appId) {
    try {
      await call(
        "POST",
        c,
        `${c.appId}/subscriptions`,
        {
          object: "page",
          callback_url: `${origin(req)}/api/meta/webhook`,
          fields: "leadgen",
          verify_token: c.verifyToken,
          include_values: "true",
        },
        `${c.appId}|${c.appSecret}`,
      );
      steps.webhook = "registered";
      await state("webhook_registered_at", time());
    } catch (e) {
      steps.webhook = e.message;
    }
  } else steps.webhook = "META_APP_ID is not set; register the webhook in the Meta dashboard.";
  try {
    steps.forms = await syncForms(c);
  } catch (e) {
    steps.forms = e.message;
  }
  await state("wiring", JSON.stringify(steps));
  return steps;
}

async function connectPage(req, page, user) {
  const c0 = await config();
  const db = await getDb();
  await db.collection("meta_state").updateOne(
    { _id: "connection" },
    {
      $set: {
        page_id: page.id,
        page_name: page.name,
        token: page.token,
        connected_at: time(),
        connected_by: user.name,
      },
    },
    { upsert: true },
  );
  await db.collection("meta_state").deleteOne({ _id: "oauth_pages" });
  await record(null, "integration", `Connected Facebook Page ${page.name} (${page.id})`, user.id);
  const c = { ...c0, pageId: page.id, pageToken: open(page.token, c0.appSecret) };
  return wire(req, c);
}

async function backfillRecent(c, perForm = 50) {
  const db = await getDb();
  const forms = await db.collection("meta_forms").find({ enabled: 1 }).toArray();
  let queued = 0;
  for (const form of forms.slice(0, 20)) {
    try {
      const data = await call("GET", c, `${form._id}/leads`, { fields: "id,ad_id", limit: perForm });
      for (const entry of data.data || [])
        if (await enqueue({ leadgen_id: String(entry.id), form_id: form._id, page_id: c.pageId, ad_id: entry.ad_id }, c.pageId, c))
          queued++;
    } catch {}
  }
  return queued;
}

export async function handleMetaAdmin(action, req, res, user) {
  const db = await getDb();
  const parsed = new URL(req.url, "http://localhost");

  if (action === "connect" && req.method === "GET") {
    const c = await config();
    if (!c.appId || !c.appSecret) {
      res.writeHead(302, { Location: crmUrl(req, "missing-app") }).end();
      return;
    }
    const nonce = randomBytes(24).toString("hex");
    await db
      .collection("meta_state")
      .updateOne(
        { _id: "oauth_state" },
        { $set: { nonce, user_id: user.id, expires: Date.now() + 600000 } },
        { upsert: true },
      );
    const dialog = new URL(`https://www.facebook.com/${c.version}/dialog/oauth`);
    dialog.searchParams.set("client_id", c.appId);
    dialog.searchParams.set("redirect_uri", `${origin(req)}/api/crm/meta/oauth-callback`);
    dialog.searchParams.set("state", nonce);
    dialog.searchParams.set("response_type", "code");
    if (c.loginConfigId) dialog.searchParams.set("config_id", c.loginConfigId);
    else dialog.searchParams.set("scope", SCOPES.join(","));
    res.writeHead(302, { Location: dialog.toString() }).end();
    return;
  }

  if (action === "oauth-callback" && req.method === "GET") {
    const c = await config();
    const saved = await db.collection("meta_state").findOne({ _id: "oauth_state" });
    const given = parsed.searchParams.get("state") || "";
    if (!saved || saved.user_id !== user.id || saved.expires < Date.now() || given !== saved.nonce) {
      res.writeHead(302, { Location: crmUrl(req, "expired") }).end();
      return;
    }
    await db.collection("meta_state").deleteOne({ _id: "oauth_state" });
    const code = parsed.searchParams.get("code");
    if (!code) {
      res.writeHead(302, { Location: crmUrl(req, "denied") }).end();
      return;
    }
    try {
      const redirect = `${origin(req)}/api/crm/meta/oauth-callback`;
      const short = await call("GET", c, "oauth/access_token", {
        client_id: c.appId,
        client_secret: c.appSecret,
        redirect_uri: redirect,
        code,
      }, "");
      const long = await call("GET", c, "oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: c.appId,
        client_secret: c.appSecret,
        fb_exchange_token: short.access_token,
      }, "");
      const accounts = await call("GET", c, "me/accounts", { fields: "id,name,access_token", limit: 100 }, long.access_token);
      const pages = (accounts.data || [])
        .filter((p) => numeric(String(p.id)) && p.access_token)
        .map((p) => ({ id: String(p.id), name: String(p.name || p.id).slice(0, 150), token: seal(p.access_token, c.appSecret) }));
      if (!pages.length) {
        res.writeHead(302, { Location: crmUrl(req, "no-pages") }).end();
        return;
      }
      const preferred = numeric(process.env.META_PAGE_ID || "") ? pages.find((p) => p.id === process.env.META_PAGE_ID) : null;
      if (preferred || pages.length === 1) {
        await connectPage(req, preferred || pages[0], user);
        res.writeHead(302, { Location: crmUrl(req, "connected") }).end();
        return;
      }
      await db
        .collection("meta_state")
        .updateOne({ _id: "oauth_pages" }, { $set: { pages, expires: Date.now() + 900000 } }, { upsert: true });
      res.writeHead(302, { Location: crmUrl(req, "choose") }).end();
    } catch (e) {
      console.error("Facebook connect failed:", e.message);
      await state("connect_error", e.message);
      res.writeHead(302, { Location: crmUrl(req, "error") }).end();
    }
    return;
  }

  if (action === "select-page" && req.method === "POST") {
    const pending = await db.collection("meta_state").findOne({ _id: "oauth_pages" });
    if (!pending || pending.expires < Date.now()) fail("That Facebook sign-in expired. Connect Facebook again.");
    const page = pending.pages.find((p) => p.id === String(req.body?.page_id || ""));
    if (!page) fail("Choose one of the listed Pages.");
    const steps = await connectPage(req, page, user);
    const imported = await processJobs(25);
    res.status(200).json({ ok: true, steps, imported, note: `Connected ${page.name}. New Meta leads will now arrive automatically.` });
    return;
  }

  if (action === "disconnect" && req.method === "POST") {
    await db.collection("meta_state").deleteMany({ _id: { $in: ["connection", "oauth_pages"] } });
    await record(null, "integration", "Disconnected Facebook Page", user.id);
    res.status(200).json({ ok: true, note: "Facebook disconnected. Existing leads are kept." });
    return;
  }

  if (action === "sync" && req.method === "POST") {
    const c = await config();
    if (!ready_(c)) fail("Connect Facebook first.");
    const steps = req.body?.rewire ? await wire(req, c) : { forms: await syncForms(c).catch((e) => e.message) };
    const queued = await backfillRecent(c);
    const imported = await processJobs(60);
    await state("last_sync", time());
    res.status(200).json({
      ok: true,
      steps,
      queued,
      imported,
      note: imported
        ? `Imported ${imported} Meta lead${imported === 1 ? "" : "s"}.`
        : "Sync complete. No new Meta leads were waiting.",
    });
    return;
  }

  if (action === "status" && req.method === "GET") {
    const c = await config();
    await processJobs(10).catch(() => {});
    const forms = await db.collection("meta_forms").find({}).sort({ label: 1 }).toArray();
    const stateRows = await db.collection("meta_state").find({ value: { $exists: true } }).toArray();
    const pending = await db.collection("meta_state").findOne({ _id: "oauth_pages" });
    const jobs = await db.collection("meta_jobs").find({}).sort({ updated_at: -1 }).limit(100).toArray();
    const counts = await db
      .collection("meta_jobs")
      .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
      .toArray();
    res.status(200).json({
      configured: ready_(c),
      flags: {
        appId: !!c.appId,
        appSecret: !!c.appSecret,
        pageConnected: ready_(c),
        webhook: !!stateRows.find((s) => s._id === "webhook_registered_at" || s._id === "verified_at"),
      },
      connection: {
        pageId: c.pageId,
        pageName: c.pageName,
        connectedAt: c.connectedAt,
        connectedBy: c.connectedBy,
        source: c.source,
      },
      pendingPages:
        pending && pending.expires > Date.now() ? pending.pages.map((p) => ({ id: p.id, name: p.name })) : [],
      pageId: c.pageId || "",
      graphVersion: c.version,
      webhookPath: "/api/meta/webhook",
      webhookUrl: `${origin(req)}/api/meta/webhook`,
      redirectUrl: `${origin(req)}/api/crm/meta/oauth-callback`,
      state: Object.fromEntries(stateRows.map((s) => [s._id, s.value])),
      forms: forms.map((f) => ({ ...f, id: f._id, form_id: f._id })),
      defaultMapping,
      jobs: jobs.map((j) => ({ ...j, leadgen_id: j._id })),
      counts: counts.map((c2) => ({ status: c2._id, count: c2.count })),
    });
    return;
  }

  if (action === "test" && req.method === "POST") {
    const c = await config();
    const data = await graph(c.pageId, { fields: "id,name" });
    await state("connection_checked_at", time());
    await state("page_name", data.name || data.id);
    res.status(200).json({
      ok: true,
      page: { id: data.id, name: data.name },
      note: `Page access verified for ${data.name || data.id}.`,
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
    for (const k of Object.keys(defaultMapping)) {
      mapping[k] = text(input.mapping?.[k] ?? defaultMapping[k], 200);
      if (["service", "location", "property"].includes(k)) defaults[k] = text(input.defaults?.[k], 200);
    }
    const ownerId = input.owner_id || null;
    if (ownerId && !(await db.collection("crm_users").findOne({ _id: ownerId, active: 1 })))
      fail("Choose an active owner.");
    if (mapping.name && !/^[\w .?'-]+$/.test(mapping.name)) fail("Use the field name returned by Meta.");
    await db.collection("meta_forms").updateOne(
      { _id: formId },
      {
        $set: { label, mapping, defaults, owner_id: ownerId, enabled: input.enabled === false ? 0 : 1, auto: 0 },
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
    if (!form) fail("Enable the form first.");
    const cursor = input.restart ? "" : form.backfill_cursor;
    if (form.backfill_complete && !input.restart) {
      res.status(200).json({ queued: 0, complete: true });
      return;
    }
    const c = await config();
    const data = await graph(`${form._id}/leads`, { fields: "id,ad_id", limit: 100, ...(cursor ? { after: cursor } : {}) });
    if (!Array.isArray(data.data)) fail("Meta did not return a lead list.", 502);
    let queued = 0;
    for (const entry of data.data)
      if (await enqueue({ leadgen_id: String(entry.id), form_id: form._id, page_id: c.pageId, ad_id: entry.ad_id }, c.pageId, c))
        queued++;
    const next = data.paging?.next ? data.paging?.cursors?.after || "" : "";
    await db
      .collection("meta_forms")
      .updateOne({ _id: form._id }, { $set: { backfill_cursor: next, backfill_complete: next ? 0 : 1 } });
    const imported = await processJobs(100);
    res.status(202).json({ queued, imported, complete: !data.paging?.next, note: `Queued ${queued}, imported ${imported}.` });
    return;
  }

  res.status(404).json({ error: "Meta integration endpoint not found." });
}
