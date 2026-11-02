import { withApi } from "../../lib/http.mjs";
import { ensureSchema } from "../../lib/db.mjs";
import { ensureCRMSchema, auth, requireAdmin } from "../../lib/crm.mjs";
import { ensureMetaSchema, handleMetaAdmin } from "../../lib/meta.mjs";

export default withApi(async (req, res) => {
  await ensureSchema();
  await ensureCRMSchema();
  await ensureMetaSchema();
  const user = await auth(req, !["GET", "HEAD"].includes(req.method));
  requireAdmin(user);
  await handleMetaAdmin(req.query.action, req, res, user);
});
