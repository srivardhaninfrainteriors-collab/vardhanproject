import { withApi } from "../../lib/http.mjs";
import { ensureSchema } from "../../lib/db.mjs";
import { ensureCRMSchema } from "../../lib/crm.mjs";
import { handleCRM } from "../../lib/crm-routes.mjs";

const routes = {
  dashboard: "/dashboard",
  export: "/export",
  setup: "/setup",
  "setup-reset": "/setup/reset",
};

export default withApi(async (req, res) => {
  await ensureSchema();
  await ensureCRMSchema();
  const route = routes[req.query.action];
  if (!route) {
    res.status(404).json({ error: "Endpoint not found." });
    return;
  }
  await handleCRM(route, req, res);
});
