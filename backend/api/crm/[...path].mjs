import { sql } from "@vercel/postgres";
import { randomBytes, randomUUID } from "node:crypto";
import { withApi, remoteAddress } from "../../lib/http.mjs";
import { limit, ensureSchema } from "../../lib/db.mjs";
import {
  roles,
  priorities,
  sha,
  fail,
  ensureCRMSchema,
  createUser,
  record,
  onLeadCreated,
  withTransaction,
  session,
  auth,
  isManager,
  requireManager,
  requireAdmin,
  lead,
  owner,
  serialize,
  inputLead,
  isoDate,
  totals,
  buildWhere,
  hashPassword,
} from "../../lib/crm.mjs";

const statuses = [
  "new",
  "contacted",
  "qualified",
  "site visit",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

async function verifyPassword(password, hash) {
  const { timingSafeEqual, scrypt: scryptCb } = await import("node:crypto");
  const { promisify } = await import("node:util");
  const scrypt = promisify(scryptCb);
  if (typeof password !== "string" || password.length > 128) return false;
  const [salt, key] = hash.split(":");
  const result = Buffer.from(await scrypt(password, salt, 64));
  return timingSafeEqual(result, Buffer.from(key, "hex"));
}

const now = () => new Date().toISOString();

export default withApi(async (req, res) => {
  await ensureSchema();
  await ensureCRMSchema();
  const secure = process.env.NODE_ENV === "production";
  const route = "/" + (Array.isArray(req.query.path) ? req.query.path.join("/") : "");
  const method = req.method;
  const address = remoteAddress(req);
  const parsed = new URL(req.url, "http://localhost");

  if (route === "/setup" && method === "POST") {
    if (!(await limit(`setup:${sha(address)}`, 5, 900000)))
      fail("Too many attempts. Try again in 15 minutes.", 429);
    const { rows: existing } = await sql`SELECT COUNT(*) n FROM crm_users`;
    if (Number(existing[0].n) > 0)
      fail("The CRM already has an administrator. Sign in and add teammates from there.", 409);
    if (!process.env.CRM_ADMIN_EMAIL || !process.env.CRM_ADMIN_PASSWORD)
      fail("Set CRM_ADMIN_EMAIL and CRM_ADMIN_PASSWORD in the api service's environment variables first.", 500);
    const admin = await createUser({
      name: process.env.CRM_ADMIN_NAME || "Studio Admin",
      email: process.env.CRM_ADMIN_EMAIL,
      password: process.env.CRM_ADMIN_PASSWORD,
      role: "admin",
    });
    res.status(201).json({ created: true, email: admin.email });
    return;
  }

  if (route === "/auth/login" && method === "POST") {
    if (!(await limit(`login:${sha(address)}`, 12, 900000)))
      fail("Too many sign-in attempts. Try again in 15 minutes.", 429);
    const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 150);
    const { rows } = await sql`SELECT * FROM crm_users WHERE email=${email} AND active=1`;
    const user = rows[0];
    const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
    const valid = await verifyPassword(req.body?.password, user?.password || dummy);
    if (!user || !valid) fail("Email or password is incorrect.", 401);
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    await sql`DELETE FROM crm_sessions WHERE expires<${Date.now()}`;
    await sql`INSERT INTO crm_sessions VALUES (${sha(token)}, ${user.id}, ${csrf}, ${Date.now() + 12 * 3600000})`;
    res.setHeader(
      "Set-Cookie",
      `sv_crm=${token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=43200${secure ? "; Secure" : ""}`,
    );
    res.status(200).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      csrf,
    });
    return;
  }

  const user = await auth(req, !["GET", "HEAD"].includes(method));
  if (!(await limit(`crm:${user.id}`, 600, 60000)))
    fail("Too many requests. Please wait a minute.", 429);

  if (route === "/auth/me" && method === "GET") {
    res.status(200).json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      csrf: user.csrf,
    });
    return;
  }

  if (route === "/auth/logout" && method === "POST") {
    await sql`DELETE FROM crm_sessions WHERE token_hash=${user.token_hash}`;
    res.setHeader(
      "Set-Cookie",
      `sv_crm=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
    );
    res.status(200).json({ ok: true });
    return;
  }

  if (route === "/auth/password" && method === "POST") {
    if (!(await limit(`password:${user.id}`, 8, 900000)))
      fail("Too many password attempts. Try again in 15 minutes.", 429);
    const { rows } = await sql`SELECT password FROM crm_users WHERE id=${user.id}`;
    if (!(await verifyPassword(req.body?.currentPassword, rows[0].password)))
      fail("Current password is incorrect.", 403);
    const password = await hashPassword(req.body?.password);
    await withTransaction(async (client) => {
      await client.sql`UPDATE crm_users SET password=${password} WHERE id=${user.id}`;
      await client.sql`DELETE FROM crm_sessions WHERE user_id=${user.id}`;
    });
    res.status(200).json({ ok: true, signInRequired: true });
    return;
  }

  if (route === "/team" && method === "GET") {
    const { rows } = await sql`SELECT id,name,email,role,active,created_at FROM crm_users ORDER BY name`;
    res.status(200).json({ users: rows });
    return;
  }

  if (route === "/team" && method === "POST") {
    requireAdmin(user);
    const member = await createUser(req.body || {});
    await record(null, "team", `Added ${member.name} as ${member.role}`, user.id);
    res.status(201).json({ user: member });
    return;
  }

  const teamMatch = route.match(/^\/team\/([0-9a-f-]{36})$/i);
  if (teamMatch && method === "PATCH") {
    requireAdmin(user);
    const id = teamMatch[1];
    const { rows } = await sql`SELECT * FROM crm_users WHERE id=${id}`;
    const member = rows[0];
    if (!member) fail("Team member not found.", 404);
    const input = req.body || {};
    if (id === user.id && (input.active === false || (input.role && input.role !== "admin")))
      fail("You cannot remove your own administrator access.");
    if (input.active !== undefined && typeof input.active !== "boolean")
      fail("Choose an access state.");
    const role = input.role ?? member.role;
    if (!roles.includes(role)) fail("Invalid role.");
    const active = input.active === undefined ? member.active : input.active ? 1 : 0;
    if (member.role === "admin" && (role !== "admin" || !active)) {
      const { rows: admins } = await sql`SELECT COUNT(*) n FROM crm_users WHERE role='admin' AND active=1`;
      if (Number(admins[0].n) <= 1) fail("Keep at least one active administrator.");
    }
    const password = input.password ? await hashPassword(input.password) : member.password;
    await withTransaction(async (client) => {
      await client.sql`UPDATE crm_users SET role=${role}, active=${active}, password=${password} WHERE id=${id}`;
      await client.sql`DELETE FROM crm_sessions WHERE user_id=${id}`;
    });
    await record(null, "team", `Updated access for ${member.name}`, user.id);
    res.status(200).json({ ok: true });
    return;
  }

  if (route === "/dashboard" && method === "GET") {
    const scoped = user.role === "agent";
    const { rows } = scoped
      ? await sql`SELECT * FROM leads WHERE archived=0 AND owner_id=${user.id}`
      : await sql`SELECT * FROM leads WHERE archived=0`;
    const stages = statuses.map((status) => ({
      status,
      count: rows.filter((r) => r.status === status).length,
      value: rows.filter((r) => r.status === status).reduce((a, r) => a + Number(r.deal_value), 0),
    }));
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
    const { rows: overdueRows } = scoped
      ? await sql`SELECT COUNT(*) n FROM crm_tasks t JOIN leads l ON l.id=t.lead_id WHERE t.completed_at IS NULL AND t.due_at<${now()} AND l.archived=0 AND l.owner_id=${user.id}`
      : await sql`SELECT COUNT(*) n FROM crm_tasks t JOIN leads l ON l.id=t.lead_id WHERE t.completed_at IS NULL AND t.due_at<${now()} AND l.archived=0`;
    const sources = ["website", "meta", "manual"].map((source) => ({
      source,
      count: rows.filter((r) => r.source === source).length,
      won: rows.filter((r) => r.source === source && r.status === "won").length,
    }));
    res.status(200).json({
      total: rows.length,
      newThisWeek: rows.filter((r) => r.created_at >= cutoff).length,
      active: rows.filter((r) => !["won", "lost"].includes(r.status)).length,
      wonValue: stages.find((s) => s.status === "won").value,
      pipelineValue: rows
        .filter((r) => !["won", "lost"].includes(r.status))
        .reduce((a, r) => a + Number(r.deal_value), 0),
      overdue: Number(overdueRows[0].n),
      stages,
      sources,
      recent: await Promise.all(
        rows
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 6)
          .map(serialize),
      ),
    });
    return;
  }

  if ((route === "/leads" || route === "/export") && method === "GET") {
    const { clause, values } = buildWhere(parsed.searchParams, user);
    const { rows: countRows } = await sql.query(`SELECT COUNT(*) n FROM leads WHERE ${clause}`, values);
    const total = Number(countRows[0].n);
    const limitRows = route === "/export" ? 10000 : 100;
    const offset =
      route === "/export"
        ? 0
        : Math.max(0, Number.parseInt(parsed.searchParams.get("offset") || "0", 10) || 0);
    const { rows: leadRows } = await sql.query(
      `SELECT * FROM leads WHERE ${clause} ORDER BY created_at DESC,id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limitRows, offset],
    );
    const rows = await Promise.all(leadRows.map(serialize));
    if (route === "/export") {
      if (total > 10000) fail("Narrow your filters to export at most 10,000 leads.");
      const keys = [
        "name", "phone", "email", "service", "location", "status", "source",
        "owner_name", "priority", "deal_value", "created_at",
      ];
      const safe = (v) =>
        '"' + String(v ?? "").replace(/^[\s]*[=+@-]/, "' $&").replaceAll('"', '""') + '"';
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="srivardhan-leads.csv"');
      res.status(200).send(
        "﻿" +
          [
            keys.join(","),
            ...rows.map((r) => keys.map((k) => safe(k === "deal_value" ? Number(r[k]) / 100 : r[k])).join(",")),
          ].join("\r\n"),
      );
      return;
    }
    res.status(200).json({ leads: rows, total, offset });
    return;
  }

  if (route === "/leads" && method === "POST") {
    const input = req.body || {};
    const payload = inputLead(input);
    const id = randomUUID();
    const ownerId = isManager(user) ? await owner(input.owner_id || null) : user.id;
    payload.consent = false;
    payload.marketingConsent = false;
    payload.consentBasis = typeof input.consentBasis === "string" ? input.consentBasis.trim().slice(0, 300) : "";
    if (!payload.consentBasis) fail("Please complete the required fields.");
    await withTransaction(async (client) => {
      await client.sql`
        INSERT INTO leads(id,request_id,created_at,status,payload) VALUES (${id}, ${randomUUID()}, ${now()}, 'new', ${JSON.stringify(payload)}::jsonb)
      `;
    });
    await onLeadCreated(id, "manual", ownerId);
    await record(id, "note", `Created by ${user.name}`, user.id);
    res.status(201).json({ id });
    return;
  }

  const match = route.match(/^\/leads\/([0-9a-f-]{36})(?:\/(notes|tasks|proposals))?$/i);
  if (match) {
    const id = match[1],
      action = match[2];
    let row = await lead(id, user);
    if (!action && method === "GET") {
      const payload = row.payload;
      const { rows: others } = user.role === "agent"
        ? await sql`SELECT id,payload,status FROM leads WHERE id!=${id} AND archived=0 AND owner_id=${user.id}`
        : await sql`SELECT id,payload,status FROM leads WHERE id!=${id} AND archived=0`;
      const duplicates = others
        .filter((r) => {
          const p = r.payload;
          return (
            (payload.phone && p.phone && p.phone.replace(/\D/g, "") === payload.phone.replace(/\D/g, "")) ||
            (payload.email && p.email && p.email.toLowerCase() === payload.email.toLowerCase())
          );
        })
        .map((r) => ({ id: r.id, name: r.payload.name, status: r.status }));
      const { rows: activity } = await sql`
        SELECT a.*,u.name actor_name FROM crm_activity a LEFT JOIN crm_users u ON a.actor_id=u.id
        WHERE a.lead_id=${id} ORDER BY a.created_at DESC
      `;
      const { rows: tasks } = await sql`
        SELECT t.*,u.name owner_name FROM crm_tasks t LEFT JOIN crm_users u ON t.owner_id=u.id
        WHERE t.lead_id=${id} ORDER BY t.due_at
      `;
      const { rows: proposalRows } = await sql`SELECT * FROM crm_proposals WHERE lead_id=${id} ORDER BY created_at DESC`;
      res.status(200).json({
        lead: await serialize(row),
        activity,
        tasks,
        proposals: proposalRows.map((r) => ({ ...r, items: JSON.parse(r.items) })),
        duplicates,
      });
      return;
    }
    if (!action && method === "PATCH") {
      const input = req.body || {};
      row = await lead(id, await auth(req, true));
      if (Number(input.version) !== Number(row.version))
        fail("This lead changed since you opened it. Refresh before saving.", 409);
      const payload = inputLead(input, row.payload),
        status = input.status ?? row.status;
      if (!statuses.includes(status)) fail("Invalid stage.");
      const priority = input.priority ?? row.priority;
      if (!priorities.includes(priority)) fail("Invalid priority.");
      const ownerId = input.owner_id === undefined ? row.owner_id : await owner(input.owner_id || null);
      if (ownerId !== row.owner_id) requireManager(user);
      const value = input.deal_value === undefined ? Number(row.deal_value) : Number(input.deal_value);
      if (!Number.isSafeInteger(value) || value < 0 || value > 1e14) fail("Invalid project value.");
      const expected =
        input.expected_close === undefined
          ? row.expected_close
          : input.expected_close
            ? isoDate(input.expected_close).slice(0, 10)
            : "";
      if (status === "lost" && !payload.lostReason) fail("Add a reason before marking a lead lost.");
      if (input.archived !== undefined && typeof input.archived !== "boolean")
        fail("Choose an archive state.");
      const archived = input.archived === undefined ? row.archived : input.archived ? 1 : 0;
      if (archived !== row.archived) requireManager(user);
      await withTransaction(async (client) => {
        await client.sql`
          UPDATE leads SET payload=${JSON.stringify(payload)}::jsonb, status=${status}, owner_id=${ownerId},
            priority=${priority}, deal_value=${value}, expected_close=${expected}, archived=${archived},
            updated_at=${now()}, version=version+1 WHERE id=${id}
        `;
      });
      await record(
        id,
        "update",
        status !== row.status
          ? `Stage changed from ${row.status} to ${status}`
          : archived !== row.archived
            ? archived ? "Lead archived" : "Lead restored"
            : "Project details updated",
        user.id,
      );
      res.status(200).json({ id, version: Number(row.version) + 1 });
      return;
    }
    if (action === "notes" && method === "POST") {
      const input = req.body || {};
      const kind = ["note", "call", "meeting", "email", "whatsapp"].includes(input.kind) ? input.kind : "note";
      const body = typeof input.body === "string" ? input.body.trim().slice(0, 4000) : "";
      if (!body) fail("Please complete the required fields.");
      await record(id, kind, body, user.id);
      res.status(201).json({ ok: true });
      return;
    }
    if (action === "tasks" && method === "POST") {
      const input = req.body || {};
      const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
      if (!title) fail("Please complete the required fields.");
      const due = isoDate(input.due_at);
      const kind = ["follow-up", "call", "site visit", "proposal", "meeting"].includes(input.kind)
        ? input.kind
        : "follow-up";
      const ownerId = isManager(user) ? await owner(input.owner_id || row.owner_id || user.id) : user.id;
      const { rows: ownerRows } = await sql`SELECT role FROM crm_users WHERE id=${ownerId}`;
      if (ownerRows[0]?.role === "agent" && ownerId !== row.owner_id)
        fail("Assign the lead to this agent before scheduling their follow-up.");
      const taskId = randomUUID();
      await sql`
        INSERT INTO crm_tasks VALUES (${taskId}, ${id}, ${ownerId}, ${title}, ${kind}, ${due}, NULL, ${now()})
      `;
      await record(id, "task", `Scheduled ${kind}: ${title}`, user.id);
      res.status(201).json({ id: taskId });
      return;
    }
    if (action === "proposals" && method === "POST") {
      const input = req.body || {};
      const proposal = totals(input.items, input.tax_rate || 0),
        proposalId = randomUUID();
      const number = `SV-${new Date().getFullYear()}-${proposalId.slice(0, 8).toUpperCase()}`;
      const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
      if (!title) fail("Please complete the required fields.");
      const terms = typeof input.terms === "string" ? input.terms.trim().slice(0, 4000) : "";
      const valid = isoDate(input.valid_until).slice(0, 10);
      await sql`
        INSERT INTO crm_proposals VALUES (
          ${proposalId}, ${id}, ${number}, ${title}, ${JSON.stringify(proposal.items)},
          ${proposal.tax}, ${proposal.total}, 'draft', ${valid}, ${terms}, ${now()}
        )
      `;
      await record(id, "proposal", `Created proposal ${number}`, user.id);
      res.status(201).json({ id: proposalId, number, total: proposal.total });
      return;
    }
  }

  if (route === "/tasks" && method === "GET") {
    const { rows } = user.role === "agent"
      ? await sql`
          SELECT t.*,l.payload,l.status lead_status,u.name owner_name FROM crm_tasks t
          JOIN leads l ON l.id=t.lead_id LEFT JOIN crm_users u ON u.id=t.owner_id
          WHERE l.archived=0 AND l.owner_id=${user.id}
          ORDER BY t.completed_at IS NOT NULL,t.due_at LIMIT 1000
        `
      : await sql`
          SELECT t.*,l.payload,l.status lead_status,u.name owner_name FROM crm_tasks t
          JOIN leads l ON l.id=t.lead_id LEFT JOIN crm_users u ON u.id=t.owner_id
          WHERE l.archived=0
          ORDER BY t.completed_at IS NOT NULL,t.due_at LIMIT 1000
        `;
    res.status(200).json({
      tasks: rows.map(({ payload, ...t }) => ({ ...t, lead_name: payload.name })),
    });
    return;
  }

  const taskMatch = route.match(/^\/tasks\/([0-9a-f-]{36})$/i);
  if (taskMatch && method === "PATCH") {
    const id = taskMatch[1];
    const { rows } = await sql`SELECT * FROM crm_tasks WHERE id=${id}`;
    const task = rows[0];
    if (!task) fail("Task not found.", 404);
    await lead(task.lead_id, user);
    const input = req.body || {};
    await lead(task.lead_id, await auth(req, true));
    if (input.completed !== undefined && typeof input.completed !== "boolean")
      fail("Choose a completion state.");
    const title = input.title === undefined ? task.title : String(input.title).trim().slice(0, 200);
    if (input.title !== undefined && !title) fail("Please complete the required fields.");
    const due = input.due_at === undefined ? task.due_at : isoDate(input.due_at);
    const kind = input.kind ?? task.kind;
    if (!["follow-up", "call", "site visit", "proposal", "meeting"].includes(kind))
      fail("Choose a valid task type.");
    const completedAt =
      input.completed === undefined ? task.completed_at : input.completed ? now() : null;
    await sql`
      UPDATE crm_tasks SET completed_at=${completedAt}, title=${title}, due_at=${due}, kind=${kind} WHERE id=${id}
    `;
    await record(
      task.lead_id,
      "task",
      `${input.completed === undefined ? "Updated follow-up" : input.completed ? "Completed" : "Reopened"}: ${title}`,
      user.id,
    );
    res.status(200).json({ ok: true });
    return;
  }

  const proposalMatch = route.match(/^\/proposals\/([0-9a-f-]{36})$/i);
  if (proposalMatch && method === "PATCH") {
    const id = proposalMatch[1];
    const { rows } = await sql`SELECT * FROM crm_proposals WHERE id=${id}`;
    const proposal = rows[0];
    if (!proposal) fail("Proposal not found.", 404);
    await lead(proposal.lead_id, user);
    const input = req.body || {};
    if (!["draft", "sent", "accepted", "declined"].includes(input.status))
      fail("Invalid proposal status.");
    await sql`UPDATE crm_proposals SET status=${input.status} WHERE id=${id}`;
    await record(proposal.lead_id, "proposal", `Proposal ${proposal.number} marked ${input.status}`, user.id);
    res.status(200).json({ ok: true });
    return;
  }

  if (route.startsWith("/meta")) {
    res.status(501).json({ error: "Meta Lead Ads integration is not yet available on this deployment." });
    return;
  }

  res.status(404).json({ error: "CRM endpoint not found." });
});
