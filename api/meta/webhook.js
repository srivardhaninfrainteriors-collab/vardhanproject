import { withApi } from "../../lib/http.mjs";
import { ensureMetaSchema, handleWebhookGet, handleWebhookPost } from "../../lib/meta.mjs";

export const config = { api: { bodyParser: false } };

async function readRaw(req, max = 256000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw Object.assign(Error("Webhook body too large."), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default withApi(async (req, res) => {
  await ensureMetaSchema();
  const parsed = new URL(req.url, "http://localhost");
  if (req.method === "GET") {
    await handleWebhookGet(req, res, parsed);
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  const raw = await readRaw(req);
  await handleWebhookPost(req, res, raw);
});
