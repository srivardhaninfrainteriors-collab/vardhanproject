import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLeadServer, validateLead, statuses } from "./index.mjs";
const token = "test-only-token-with-at-least-32-characters";
const valid = () => ({
  name: "Test inquiry",
  phone: "+91 90000 00001",
  service: "Luxury interior design",
  location: "Vijayawada",
  property: "Apartment",
  budget: "Not decided",
  timeline: "Exploring options",
  consent: true,
  requestId: randomUUID(),
});
test("validation rejects invalid consent, contact details, spam and hostile inputs", () => {
  for (const patch of [
    { consent: false },
    { phone: "123" },
    { name: "A" },
    { service: "fake" },
    { property: "fake" },
    { website: "bot" },
    { area: "-1" },
    { location: 42 },
    { message: "x".repeat(2001) },
  ])
    assert.throws(() => validateLead({ ...valid(), ...patch }));
  assert.deepEqual(
    validateLead({ ...valid(), attribution: { utm_source: "ads" } })
      .attribution,
    {},
  );
  assert.equal(
    validateLead({
      ...valid(),
      analyticsConsent: true,
      attribution: { utm_source: "ads" },
    }).attribution.utm_source,
    "ads",
  );
});
test("end-to-end persistence, idempotency, staff authentication, status workflow, rate limits and deletion", async () => {
  const dir = mkdtempSync(join(tmpdir(), "srivardhan-test-"));
  const dbPath = join(dir, "leads.sqlite");
  let server = createLeadServer({
    dbPath,
    adminToken: token,
    origins: ["https://example.test"],
  });
  const listen = () =>
    new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  await listen();
  let base = `http://127.0.0.1:${server.address().port}/api`;
  const send = (
    path,
    method = "GET",
    data,
    auth = false,
    origin = "https://example.test",
  ) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  try {
    assert.equal((await send("/leads")).status, 401);
    assert.equal(
      (await send("/leads", "POST", valid(), false, "https://evil.test"))
        .status,
      403,
    );
    assert.equal(
      (await send("/leads", "POST", { ...valid(), consent: false })).status,
      400,
    );
    const input = valid();
    const response = await send("/leads", "POST", input);
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.ok(result.id);
    assert.equal(
      (await (await send("/leads", "POST", input)).json()).id,
      result.id,
    );
    assert.equal(
      (await send("/leads", "POST", { ...input, name: "Different sender" }))
        .status,
      409,
    );
    const saved = await (await send("/leads", "GET", null, true)).json();
    assert.equal(saved.leads.length, 1);
    assert.equal(saved.leads[0].name, input.name);
    assert.equal(saved.leads[0].notification_status, "not_configured");
    assert.equal(saved.total, 1);
    const older = await (
      await send("/leads?offset=100", "GET", null, true)
    ).json();
    assert.equal(older.leads.length, 0);
    assert.equal(older.total, 1);
    for (const status of statuses)
      assert.equal(
        (await send(`/leads/${result.id}`, "PATCH", { status }, true)).status,
        200,
      );
    assert.equal(
      (await send(`/leads/${result.id}`, "PATCH", { status: "invented" }, true))
        .status,
      400,
    );
    assert.equal(
      (await send(`/leads/${result.id}`, "PATCH", { status: "new" })).status,
      401,
    );
    await new Promise((resolve) => server.close(resolve));
    server = createLeadServer({
      dbPath,
      adminToken: token,
      origins: ["https://example.test"],
    });
    await listen();
    base = `http://127.0.0.1:${server.address().port}/api`;
    const afterRestart = await (await send("/leads", "GET", null, true)).json();
    assert.equal(afterRestart.leads[0].status, "lost");
    assert.equal((await send("/leads", "POST", valid())).status, 201);
    assert.equal((await send("/leads", "POST", valid())).status, 201);
    assert.equal((await send("/leads", "POST", valid())).status, 429);
    assert.equal(
      (await send(`/leads/${result.id}`, "DELETE", null, true)).status,
      200,
    );
    assert.equal(
      (await send(`/leads/${result.id}`, "PATCH", { status: "new" }, true))
        .status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
