import { withApi } from "../../lib/http.mjs";
import { ensureSchema } from "../../lib/db.mjs";
import { ensureCRMSchema } from "../../lib/crm.mjs";
import { handleCRM } from "../../lib/crm-routes.mjs";

export default withApi(async (req, res) => {
  await ensureSchema();
  await ensureCRMSchema();
  const { id, action } = req.query;
  const route = id ? (action ? `/leads/${id}/${action}` : `/leads/${id}`) : "/leads";
  await handleCRM(route, req, res);
});
