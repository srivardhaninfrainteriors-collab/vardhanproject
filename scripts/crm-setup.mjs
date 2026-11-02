import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { writeFileSync, chmodSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createLeadServer } from "../server/index.mjs";
import { hashPassword } from "../server/crm.mjs";
const dbPath = resolve(process.env.LEADS_DB || "data/leads.sqlite");
const server = createLeadServer({ dbPath });
const db = new DatabaseSync(dbPath);
try {
  const reset = process.argv.includes("--reset");
  const email = (
    process.env.CRM_ADMIN_EMAIL || "admin@srivardhan.local"
  ).toLowerCase();
  const password =
    process.env.CRM_ADMIN_PASSWORD || randomBytes(24).toString("base64url");
  if (reset) {
    if (!process.env.CRM_ADMIN_EMAIL)
      throw Error("Set CRM_ADMIN_EMAIL to the account being recovered.");
    const user = db
      .prepare("SELECT id FROM crm_users WHERE email=? AND role=?")
      .get(email, "admin");
    if (!user) throw Error("No administrator with that email exists.");
    const encoded = await hashPassword(password);
    db.exec("BEGIN IMMEDIATE");
    db.prepare("UPDATE crm_users SET password=?,active=1 WHERE id=?").run(
      encoded,
      user.id,
    );
    db.prepare("DELETE FROM crm_sessions WHERE user_id=?").run(user.id);
    db.exec("COMMIT");
  } else {
    if (db.prepare("SELECT COUNT(*) count FROM crm_users").get().count)
      throw Error(
        "The CRM already has users. Add teammates inside the CRM, or use --reset with CRM_ADMIN_EMAIL for administrator recovery.",
      );
    await server.createCRMUser({
      name: process.env.CRM_ADMIN_NAME || "Studio Admin",
      email,
      password,
      role: "admin",
    });
  }
  if (!process.env.CRM_ADMIN_PASSWORD) {
    const file = join(dirname(dbPath), "crm-access.txt");
    writeFileSync(
      file,
      `SRIVARDHAN CRM — local administrator access\n\nURL: http://127.0.0.1:${process.env.PORT || 8791}${process.env.SITE_BASE_PATH || "/vardhanproject/"}crm/\nEmail: ${email}\nPassword: ${password}\n\nKeep this file private. Change the password in CRM Settings, then delete this file.\n`,
      { mode: 0o600 },
    );
    chmodSync(file, 0o600);
    console.log(
      `Administrator ${reset ? "recovered" : "created"}. Private sign-in details: ${file}`,
    );
  } else
    console.log(
      `Administrator ${reset ? "recovered" : "created"} using the credentials supplied in your environment.`,
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
  server.close();
}
