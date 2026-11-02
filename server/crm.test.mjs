import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createLeadServer } from "./index.mjs";
const password = "Only-for-local-tests-835!";
async function workspace(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "sv-crm-"));
  const dbPath = join(dir, "leads.sqlite");
  let server, base;
  const start = async () => {
    server = createLeadServer({
      dbPath,
      secureCookies: false,
      origins: ["https://studio.test"],
      ...options,
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
  };
  await start();
  const db = new DatabaseSync(dbPath);
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  async function client(email = "admin@studio.test", pass = password) {
    const response = await fetch(base + "/api/crm/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://studio.test",
      },
      body: JSON.stringify({ email, password: pass }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    const { user, csrf } = await response.json();
    const cookie = response.headers.get("set-cookie").split(";")[0];
    assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Lax/);
    return {
      user,
      cookie,
      csrf,
      call: async (path, method = "GET", body, extra = {}) => {
        const res = await fetch(base + "/api/crm" + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            Origin: "https://studio.test",
            Cookie: cookie,
            "X-CSRF-Token": csrf,
            ...extra,
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        const data = res.headers
          .get("content-type")
          ?.includes("application/json")
          ? await res.json()
          : await res.text();
        return { status: res.status, data };
      },
    };
  }
  await server.createCRMUser({
    name: "Studio Admin",
    email: "admin@studio.test",
    password,
    role: "admin",
  });
  return {
    db,
    client,
    raw: (path, options) => fetch(base + path, options),
    restart: async () => {
      await new Promise((r) => server.close(r));
      await start();
    },
    process: () => server.processMetaJobs(),
  };
}
const inquiry = (extra = {}) => ({
  name: "Maya Rao",
  phone: "+91 90000 00123",
  email: "maya@example.test",
  service: "Luxury interior design",
  location: "Vijayawada",
  consentBasis: "Requested a consultation by phone",
  ...extra,
});
const ok = async (promise, status = 200) => {
  const r = await promise;
  assert.equal(r.status, status, JSON.stringify(r.data));
  return r.data;
};
async function eventually(check) {
  for (let i = 0; i < 150; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail("Queued operation did not reach expected state");
}

test("CRM: sign-in, CSRF, strict JSON, roles, lead isolation, filters and session revocation", async (t) => {
  const w = await workspace(t),
    admin = await w.client();
  assert.equal((await w.raw("/api/crm/leads")).status, 401);
  await ok(
    admin.call("/leads", "POST", inquiry(), { "X-CSRF-Token": "wrong" }),
    403,
  );
  await ok(admin.call("/leads", "POST", null), 400);
  await ok(
    admin.call("/leads", "POST", inquiry(), {
      Origin: "https://untrusted.test",
    }),
    403,
  );
  const agent = (
    await ok(
      admin.call("/team", "POST", {
        name: "Agent One",
        email: "agent@studio.test",
        password,
        role: "agent",
      }),
      201,
    )
  ).user;
  const manager = (
    await ok(
      admin.call("/team", "POST", {
        name: "Manager",
        email: "manager@studio.test",
        password,
        role: "manager",
      }),
      201,
    )
  ).user;
  const a = await w.client(agent.email),
    m = await w.client(manager.email);
  const own = await ok(
    admin.call("/leads", "POST", inquiry({ owner_id: agent.id })),
    201,
  );
  const other = await ok(
    admin.call(
      "/leads",
      "POST",
      inquiry({
        name: "100% Design",
        phone: "+91 90000 00999",
        email: "other@example.test",
      }),
    ),
    201,
  );
  assert.equal((await ok(a.call("/leads"))).total, 1);
  assert.equal((await ok(m.call("/leads"))).total, 2);
  assert.equal((await ok(a.call("/dashboard"))).total, 1);
  await ok(a.call(`/leads/${other.id}`), 404);
  await ok(
    a.call(`/leads/${own.id}`, "PATCH", { version: 1, owner_id: manager.id }),
    403,
  );
  await ok(
    a.call("/team", "POST", { name: "No", email: "no@example.test", password }),
    403,
  );
  await ok(m.call("/meta"), 403);
  const exported = await ok(a.call("/export"));
  assert.match(exported, /Maya Rao/);
  assert.doesNotMatch(exported, /100% Design/);
  assert.equal((await ok(admin.call("/leads?q=%25"))).total, 1);
  assert.equal((await ok(admin.call("/leads?q=%27%20OR%201%3D1--"))).total, 0);
  assert.equal((await ok(admin.call("/leads?owner_id=unassigned"))).total, 1);
  assert.equal((await ok(admin.call("/leads?offset=100"))).leads.length, 0);
  await ok(
    admin.call(`/team/${admin.user.id}`, "PATCH", { active: false }),
    400,
  );
  await ok(admin.call(`/team/${agent.id}`, "PATCH", { active: false }));
  await ok(a.call("/leads"), 401);
  assert.ok(
    w.db.prepare("SELECT password FROM crm_users WHERE id=?").get(admin.user.id)
      .password !== password,
  );
  await ok(admin.call("/auth/logout", "POST", {}));
  await ok(admin.call("/auth/me"), 401);
});

test("CRM: pipeline, optimistic concurrency, duplicate contact hints, tasks, proposals, CSV and archiving", async (t) => {
  const w = await workspace(t),
    admin = await w.client();
  const { id } = await ok(admin.call("/leads", "POST", inquiry()), 201);
  await ok(
    admin.call("/leads", "POST", inquiry({ name: "Second project" })),
    201,
  );
  assert.equal((await ok(admin.call(`/leads/${id}`))).duplicates.length, 1);
  await ok(
    admin.call(`/leads/${id}`, "PATCH", { version: 1, status: "lost" }),
    400,
  );
  const concurrent = await Promise.all([
    admin.call(`/leads/${id}`, "PATCH", {
      version: 1,
      status: "qualified",
      deal_value: 250000000,
    }),
    admin.call(`/leads/${id}`, "PATCH", { version: 1, status: "contacted" }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  let lead = (await ok(admin.call(`/leads/${id}`))).lead;
  await ok(
    admin.call(`/leads/${id}`, "PATCH", {
      version: lead.version,
      status: "qualified",
      deal_value: 250000000,
      priority: "high",
      expected_close: "2027-03-01",
    }),
  );
  assert.equal((await ok(admin.call("/dashboard"))).pipelineValue, 250000000);
  await ok(
    admin.call(`/leads/${id}/notes`, "POST", {
      kind: "call",
      body: "Discussed villa scope. No outbound message sent.",
    }),
    201,
  );
  const task = await ok(
    admin.call(`/leads/${id}/tasks`, "POST", {
      title: "Book the site visit",
      due_at: "2026-01-01T09:00:00+05:30",
      kind: "site visit",
    }),
    201,
  );
  assert.equal((await ok(admin.call("/dashboard"))).overdue, 1);
  await ok(admin.call(`/tasks/${task.id}`, "PATCH", { completed: true }));
  assert.equal((await ok(admin.call("/dashboard"))).overdue, 0);
  await ok(
    admin.call(`/tasks/${task.id}`, "PATCH", {
      title: "Revised site visit",
      due_at: "2027-02-01T10:00:00+05:30",
      kind: "meeting",
    }),
  );
  let revised = (await ok(admin.call(`/leads/${id}`))).tasks[0];
  assert.equal(revised.title, "Revised site visit");
  assert.equal(revised.due_at, "2027-02-01T04:30:00.000Z");
  await ok(
    admin.call(`/tasks/${task.id}`, "PATCH", {
      due_at: "2026-01-01T03:30:00.000Z",
    }),
  );
  await ok(admin.call(`/tasks/${task.id}`, "PATCH", { completed: false }));
  const proposal = {
    title: "Living room scope",
    valid_until: "2027-04-01",
    items: [
      { description: "Design services", quantity: 1.5, price: 100.25 },
      { description: "Materials", quantity: 2, price: 200.1 },
    ],
    tax_rate: 18,
    terms: "Review before sharing.",
  };
  const quote = await ok(
    admin.call(`/leads/${id}/proposals`, "POST", proposal),
    201,
  );
  assert.equal(quote.total, 64968);
  await ok(
    admin.call(`/leads/${id}/proposals`, "POST", {
      ...proposal,
      items: [{ description: "Overflow", quantity: 1e6, price: 1e9 }],
    }),
    400,
  );
  await ok(
    admin.call(`/proposals/${quote.id}`, "PATCH", { status: "accepted" }),
  );
  let detail = await ok(admin.call(`/leads/${id}`));
  assert.equal(detail.proposals[0].status, "accepted");
  assert.equal(detail.tasks[0].due_at, "2026-01-01T03:30:00.000Z");
  assert.ok(detail.activity.some((a) => a.kind === "call"));
  await ok(
    admin.call(`/leads/${id}`, "PATCH", {
      version: detail.lead.version,
      status: "won",
      name: '=HYPERLINK("bad")',
    }),
  );
  assert.equal((await ok(admin.call("/dashboard"))).wonValue, 250000000);
  const csv = await ok(admin.call("/export"));
  assert.match(csv, /' =HYPERLINK\(""bad""\)/);
  assert.match(csv, /' \+91/);
  detail = await ok(admin.call(`/leads/${id}`));
  await ok(
    admin.call(`/leads/${id}`, "PATCH", {
      version: detail.lead.version,
      archived: true,
    }),
  );
  assert.equal((await ok(admin.call("/leads"))).total, 1);
  assert.equal((await ok(admin.call("/leads?archived=1"))).total, 1);
  assert.equal((await ok(admin.call("/tasks"))).tasks.length, 0);
  await w.restart();
  const signedIn = await w.client();
  assert.equal(
    (await ok(signedIn.call(`/leads/${id}`))).proposals[0].total,
    64968,
  );
});

test("CRM: password changes revoke sessions; website inquiries arrive with provenance and consent", async (t) => {
  const w = await workspace(t),
    admin = await w.client(),
    second = await w.client();
  const res = await w.raw("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...inquiry(),
      property: "Villa",
      consent: true,
      requestId: randomUUID(),
    }),
  });
  assert.equal(res.status, 201);
  const { id } = await res.json();
  const detail = await ok(admin.call(`/leads/${id}`));
  assert.equal(detail.lead.source, "website");
  assert.equal(detail.lead.consent, true);
  assert.equal(detail.activity[0].kind, "created");
  await ok(
    admin.call("/auth/password", "POST", {
      currentPassword: "wrong-password",
      password: "Another-strong-password",
    }),
    403,
  );
  await ok(
    admin.call("/auth/password", "POST", {
      currentPassword: password,
      password: "Another-strong-password",
    }),
  );
  await ok(second.call("/auth/me"), 401);
  await w.client("admin@studio.test", "Another-strong-password");
});

const meta = {
  appSecret: "TEST-APP-SECRET",
  verifyToken: "TEST-VERIFY",
  pageToken: "TEST-PAGE-TOKEN",
  pageId: "12345",
  version: "v99.0",
};
const delivery = (id = "9001", form = "456", page = meta.pageId) => ({
  object: "page",
  entry: [
    {
      id: page,
      changes: [
        {
          field: "leadgen",
          value: {
            leadgen_id: id,
            page_id: page,
            form_id: form,
            ad_id: "7001",
          },
        },
      ],
    },
  ],
});
async function webhook(w, event, signature) {
  const raw = JSON.stringify(event);
  return w.raw("/api/meta/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256":
        signature ||
        "sha256=" +
          createHmac("sha256", meta.appSecret).update(raw).digest("hex"),
    },
    body: raw,
  });
}
const leadData = (id = "9001", form = "456") => ({
  id,
  form_id: form,
  ad_id: "7001",
  created_time: "2026-10-29T09:10:00+0000",
  field_data: [
    { name: "full_name", values: ["Meta Test Client"] },
    { name: "phone_number", values: ["+91 90000 00888"] },
    { name: "project_budget", values: ["₹50 lakh"] },
    { name: "custom_finish", values: ["Stone & timber"] },
  ],
  custom_disclaimer_responses: [
    { checkbox_key: "contact_request", is_checked: true },
  ],
});

test("Meta: signed delivery, Page isolation, field mapping, custom answers, idempotency and secret protection", async (t) => {
  let calls = 0;
  const w = await workspace(t, {
      meta,
      metaFetch: async (url, options) => {
        calls++;
        assert.equal(new URL(url).hostname, "graph.facebook.com");
        assert.equal(options.headers.Authorization, `Bearer ${meta.pageToken}`);
        assert.ok(new URL(url).searchParams.has("appsecret_proof"));
        return Response.json(leadData());
      },
    }),
    admin = await w.client();
  assert.equal(
    (
      await w.raw(
        "/api/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=111",
      )
    ).status,
    403,
  );
  assert.equal(
    await (
      await w.raw(
        "/api/meta/webhook?hub.mode=subscribe&hub.verify_token=TEST-VERIFY&hub.challenge=123",
      )
    ).text(),
    "123",
  );
  await ok(
    admin.call("/meta/forms", "POST", {
      form_id: "456",
      label: "Villa consultations",
      mapping: { message: "custom_finish" },
      defaults: { location: "Vijayawada", service: "Luxury interior design" },
      owner_id: admin.user.id,
    }),
  );
  assert.equal(
    (await webhook(w, delivery(), "sha256=" + "0".repeat(64))).status,
    401,
  );
  const wrong = await webhook(w, delivery("123", "456", "999"));
  assert.equal((await wrong.json()).accepted, 0);
  assert.equal(w.db.prepare("SELECT COUNT(*) n FROM meta_jobs").get().n, 0);
  assert.equal((await webhook(w, delivery())).status, 200);
  await eventually(
    () =>
      w.db.prepare("SELECT status FROM meta_jobs WHERE leadgen_id='9001'").get()
        ?.status === "imported",
  );
  await webhook(w, delivery());
  await w.process();
  assert.equal(calls, 1);
  assert.equal(
    w.db.prepare("SELECT COUNT(*) n FROM leads WHERE source='meta'").get().n,
    1,
  );
  const list = await ok(admin.call("/leads?source=meta")),
    lead = list.leads[0];
  assert.equal(lead.name, "Meta Test Client");
  assert.equal(lead.message, "Stone & timber");
  assert.equal(lead.location, "Vijayawada");
  assert.equal(lead.owner_id, admin.user.id);
  assert.equal(lead.marketingConsent, false);
  assert.equal(lead.consent, false);
  assert.equal(lead.meta.answers.custom_finish, "Stone & timber");
  assert.equal(lead.meta.custom_disclaimer_responses[0].is_checked, true);
  assert.equal(lead.attribution.ad_id, "7001");
  const settings = await ok(admin.call("/meta"));
  assert.equal(settings.configured, true);
  for (const secret of [meta.appSecret, meta.pageToken, meta.verifyToken])
    assert.ok(!JSON.stringify(settings).includes(secret));
});

test("Meta: unmapped forms recover, transient errors retry, paused forms fail safely, mismatched IDs never import", async (t) => {
  let mode = "success";
  const w = await workspace(t, {
      meta,
      metaFetch: async (url) => {
        const id = new URL(url).pathname.split("/").pop();
        if (mode === "transient")
          return Response.json({ error: { code: 4 } }, { status: 429 });
        return Response.json(leadData(mode === "mismatch" ? "9999" : id));
      },
    }),
    admin = await w.client();
  await webhook(w, delivery());
  await eventually(
    () =>
      w.db.prepare("SELECT status FROM meta_jobs WHERE leadgen_id='9001'").get()
        ?.status === "failed",
  );
  await ok(
    admin.call("/meta/forms", "POST", { form_id: "456", label: "Form" }),
  );
  mode = "transient";
  await ok(admin.call("/meta/retry", "POST", { leadgen_id: "9001" }), 202);
  await eventually(
    () =>
      w.db.prepare("SELECT status FROM meta_jobs WHERE leadgen_id='9001'").get()
        ?.status === "retry",
  );
  assert.equal(w.db.prepare("SELECT COUNT(*) n FROM leads").get().n, 0);
  mode = "success";
  await ok(admin.call("/meta/retry", "POST", { leadgen_id: "9001" }), 202);
  await eventually(
    () =>
      w.db.prepare("SELECT status FROM meta_jobs WHERE leadgen_id='9001'").get()
        ?.status === "imported",
  );
  mode = "mismatch";
  await webhook(w, delivery("9002"));
  await eventually(
    () =>
      w.db.prepare("SELECT status FROM meta_jobs WHERE leadgen_id='9002'").get()
        ?.status === "failed",
  );
  assert.equal(w.db.prepare("SELECT COUNT(*) n FROM leads").get().n, 1);
  await ok(
    admin.call("/meta/forms", "POST", {
      form_id: "456",
      label: "Form",
      enabled: false,
    }),
  );
  await webhook(w, delivery("9003"));
  await eventually(
    () =>
      w.db.prepare("SELECT status FROM meta_jobs WHERE leadgen_id='9003'").get()
        ?.status === "failed",
  );
});

test("Meta: historical imports persist cursors, use trusted Graph URLs and recover queued jobs after restart", async (t) => {
  let history = 0;
  const seen = [];
  const w = await workspace(t, {
      meta,
      metaFetch: async (url) => {
        const u = new URL(url);
        seen.push(u);
        assert.equal(u.hostname, "graph.facebook.com");
        if (u.pathname.endsWith("/leads")) {
          history++;
          if (!u.searchParams.has("after"))
            return Response.json({
              data: [{ id: "9001" }],
              paging: {
                next: "https://untrusted.example/?access_token=bad",
                cursors: { after: "page-two" },
              },
            });
          assert.equal(u.searchParams.get("after"), "page-two");
          return Response.json({ data: [{ id: "9002" }] });
        }
        return Response.json(leadData(u.pathname.split("/").pop()));
      },
    }),
    admin = await w.client();
  await ok(
    admin.call("/meta/forms", "POST", { form_id: "456", label: "History" }),
  );
  assert.equal(
    (await ok(admin.call("/meta/backfill", "POST", { form_id: "456" }), 202))
      .complete,
    false,
  );
  await eventually(
    () =>
      w.db.prepare("SELECT status FROM meta_jobs WHERE leadgen_id='9001'").get()
        ?.status === "imported",
  );
  assert.equal(
    w.db.prepare("SELECT backfill_cursor FROM meta_forms").get()
      .backfill_cursor,
    "page-two",
  );
  await w.restart();
  const again = await w.client();
  assert.equal(
    (await ok(again.call("/meta/backfill", "POST", { form_id: "456" }), 202))
      .complete,
    true,
  );
  await eventually(
    () =>
      w.db.prepare("SELECT status FROM meta_jobs WHERE leadgen_id='9002'").get()
        ?.status === "imported",
  );
  await ok(again.call("/meta/backfill", "POST", { form_id: "456" }));
  assert.equal(history, 2);
  w.db
    .prepare("UPDATE meta_jobs SET status='processing' WHERE leadgen_id='9002'")
    .run();
  await w.restart();
  await eventually(
    () =>
      w.db.prepare("SELECT status FROM meta_jobs WHERE leadgen_id='9002'").get()
        ?.status === "imported",
  );
  assert.equal(w.db.prepare("SELECT COUNT(*) n FROM leads").get().n, 2);
});
