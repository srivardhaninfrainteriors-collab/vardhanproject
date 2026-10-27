import { withApi } from "../lib/http.mjs";

export default withApi(async (req, res) => {
  res.status(200).json({ ok: true });
});
