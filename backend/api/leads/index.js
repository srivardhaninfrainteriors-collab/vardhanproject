import { sql } from "@vercel/postgres";
import { randomUUID } from "node:crypto";
import { withApi, remoteAddress, adminOK, hash } from "../../lib/http.mjs";
import { ensureSchema, limit } from "../../lib/db.mjs";
import { validateLead, fields } from "../../lib/lead.mjs";
import { notify, metaConversion } from "../../lib/notify.mjs";

export default withApi(async (req, res) => {
  await ensureSchema();
  const address = remoteAddress(req);

  if (req.method === "POST") {
    if (!String(req.headers["content-type"]).startsWith("application/json")) {
      res.status(415).json({ error: "Use application/json." });
      return;
    }
    let data;
    try {
      data = validateLead(req.body);
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
      return;
    }
    const { rows: existingRows } = await sql`
      SELECT id, payload FROM leads WHERE request_id=${data.requestId}
    `;
    const existing = existingRows[0];
    if (existing) {
      const prior = existing.payload;
      if (Object.keys(fields).some((key) => prior[key] !== data[key])) {
        res.status(409).json({
          error:
            "An earlier version of this inquiry is already saved. Please call or WhatsApp the team to update its details.",
        });
        return;
      }
      res.status(200).json({ id: existing.id, saved: true });
      return;
    }
    if (
      !(await limit(`ip:${hash(address)}`, 10, 3600000)) ||
      !(await limit(`phone:${hash(data.phone.replace(/\D/g, ""))}`, 3, 3600000))
    ) {
      res.setHeader("Retry-After", "3600");
      res.status(429).json({
        error: "Too many inquiries. Please call the team or try again later.",
      });
      return;
    }
    const id = randomUUID();
    const webhook = process.env.LEAD_WEBHOOK_URL;
    await sql`
      INSERT INTO leads(id, request_id, created_at, status, payload, notification_status)
      VALUES (${id}, ${data.requestId}, ${new Date().toISOString()}, 'new', ${JSON.stringify(data)}, ${webhook ? "pending" : "not_configured"})
    `;
    res.status(201).json({ id, saved: true });
    await Promise.allSettled([notify(id, data), metaConversion(id, data, req)]);
    return;
  }

  if (req.method === "GET") {
    if (!(await limit(`admin:${hash(address)}`, 120, 60000))) {
      res.status(429).json({ error: "Too many requests." });
      return;
    }
    if (!adminOK(req)) {
      res.status(401).json({ error: "Authorised staff access is required." });
      return;
    }
    const offset = Math.max(
      0,
      Math.min(10000000, Number.parseInt(req.query.offset || "0", 10) || 0),
    );
    const { rows } = await sql`
      SELECT * FROM leads ORDER BY created_at DESC LIMIT 100 OFFSET ${offset}
    `;
    const { rows: countRows } = await sql`SELECT COUNT(*) AS count FROM leads`;
    res.status(200).json({
      total: Number(countRows[0].count),
      offset,
      leads: rows.map((r) => ({
        ...r.payload,
        id: r.id,
        created_at: r.created_at,
        status: r.status,
        notification_status: r.notification_status,
      })),
    });
    return;
  }

  res.status(404).json({ error: "Endpoint not found." });
});
