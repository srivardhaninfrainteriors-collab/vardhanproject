import { withApi, remoteAddress, adminOK, hash } from "../../lib/http.mjs";
import { ensureSchema, limit, getDb } from "../../lib/db.mjs";
import { statuses } from "../../lib/lead.mjs";

export default withApi(async (req, res) => {
  await ensureSchema();
  const db = await getDb();
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
  const existing = await db.collection("leads").findOne({ _id: id }, { projection: { _id: 1 } });
  if (!existing) {
    res.status(404).json({ error: "Inquiry not found." });
    return;
  }
  if (req.method === "PATCH") {
    const status = req.body?.status;
    if (!statuses.includes(status)) {
      res.status(400).json({ error: "Invalid lead status." });
      return;
    }
    await db.collection("leads").updateOne({ _id: id }, { $set: { status } });
    await db.collection("audit").insertOne({
      lead_id: id,
      created_at: new Date().toISOString(),
      status,
    });
    res.status(200).json({ id, status });
    return;
  }
  if (req.method === "DELETE") {
    await db.collection("audit").deleteMany({ lead_id: id });
    await db.collection("leads").deleteOne({ _id: id });
    res.status(200).json({ deleted: true });
    return;
  }
  res.status(404).json({ error: "Endpoint not found." });
});
