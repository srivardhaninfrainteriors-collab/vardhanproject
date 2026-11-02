import { withApi } from "../../../../lib/http.mjs";
import { ensureSchema } from "../../../../lib/db.mjs";
import { ensureCRMSchema } from "../../../../lib/crm.mjs";
import { handleCRM } from "../../../../lib/crm-routes.mjs";

export default withApi(async (req, res) => {
  await ensureSchema();
  await ensureCRMSchema();
  await handleCRM(`/leads/${req.query.id}/notes`, req, res);
});
