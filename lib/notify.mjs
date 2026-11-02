import { sql } from "@vercel/postgres";
import { createHash } from "node:crypto";

const hash = (value) => createHash("sha256").update(value).digest("hex");

export async function notify(id, data) {
  const webhook = process.env.LEAD_WEBHOOK_URL;
  if (!webhook) return;
  try {
    const target = new URL(webhook);
    if (target.protocol !== "https:") throw Error("Webhook must use HTTPS");
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.LEAD_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${process.env.LEAD_WEBHOOK_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ event: "lead.created", id, ...data }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error("Webhook failed");
    await sql`UPDATE leads SET notification_status='delivered' WHERE id=${id}`;
  } catch {
    await sql`UPDATE leads SET notification_status='failed' WHERE id=${id}`;
    console.error("Lead saved; notification delivery failed for reference", id);
  }
}

export async function metaConversion(id, data, req) {
  const base = process.env.SITE_BASE_PATH || "/vardhanproject/";
  const frontendOrigin =
    process.env.SITE_URL ||
    "https://srivardhaninfrainteriors-collab.github.io/vardhanproject/";
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

export { hash };
