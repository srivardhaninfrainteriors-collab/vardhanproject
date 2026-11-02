import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
const file = resolve(
  process.argv[2] ||
    `data/backups/crm-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
const db = new DatabaseSync(
  resolve(process.env.LEADS_DB || "data/leads.sqlite"),
  { readOnly: true },
);
try {
  db.prepare("VACUUM INTO ?").run(file);
  chmodSync(file, 0o600);
  console.log(`Consistent CRM snapshot saved: ${file}`);
} finally {
  db.close();
}
