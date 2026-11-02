import { sql } from "@vercel/postgres";
import { withApi, remoteAddress, adminOK, hash } from "../../lib/http.mjs";
import { ensureSchema, limit } from "../../lib/db.mjs";
import { statuses } from "../../lib/lead.mjs";

export default withApi(async (req, res) => {
  await ensureSchema();
  const address = remoteAddress(req);
  if (!(await limit(`admin:${hash(address)}`, 120, 60000))) {
    res.status(429).json({ error: "Too many requests." });
    return;
  }
  if (!adminOK(req)) {
    res.status(401).json({ error: "Authorised staff access is required." });
    return;
  }
  const { id } = req.query;
  const { rows } = await sql`SELECT id FROM leads WHERE id=${id}`;
  if (!rows[0]) {
    res.status(404).json({ error: "Inquiry not found." });
    return;
  }
  if (req.method === "PATCH") {
    const status = req.body?.status;
    if (!statuses.includes(status)) {
      res.status(400).json({ error: "Invalid lead status." });
      return;
    }
    await sql`UPDATE leads SET status=${status} WHERE id=${id}`;
    await sql`
      INSERT INTO audit(lead_id, created_at, status) VALUES (${id}, ${new Date().toISOString()}, ${status})
    `;
    res.status(200).json({ id, status });
    return;
  }
  if (req.method === "DELETE") {
    await sql`DELETE FROM audit WHERE lead_id=${id}`;
    await sql`DELETE FROM leads WHERE id=${id}`;
    res.status(200).json({ deleted: true });
    return;
  }
  res.status(404).json({ error: "Endpoint not found." });
});
