# SRIVARDHAN Relationship Studio — CRM guide

The website and CRM now share a durable SQLite lead store. Open `/vardhanproject/crm/`; `/vardhanproject/admin/` is an alias. Private routes are excluded from the sitemap, marked noindex, and do not initialize the public website’s advertising or analytics scripts.

## Start locally

Requires Node 24 or newer.

```sh
npm ci
npm run build
npm run crm:setup
npm run server
```

Open `http://127.0.0.1:8791/vardhanproject/crm/`. The same server serves the public website and automatically connects its inquiry forms to `/api/leads`. The local administrator was created during implementation; its generated sign-in details are in ignored `data/crm-access.txt` with owner-only permissions. Setup refuses to create another initial account when users already exist. No default password is embedded in the application.

For a new deployment, optionally supply `CRM_ADMIN_NAME`, `CRM_ADMIN_EMAIL`, and `CRM_ADMIN_PASSWORD` privately to `npm run crm:setup`. Without a supplied password, setup generates a random one and writes a private access file beside the database. Change it in CRM Settings, then delete the access file. Remove setup-only credentials from the environment after use. Keep runtime secrets out of Git and out of `VITE_` variables.

For development, run `npm run dev` in another terminal. Vite proxies `/api` to port 8791. `npm run preview` is a static preview, not the complete CRM service. Use port 8791 to review the production build with working sign-in.

## Daily workflow

| Workspace | What it does |
|---|---|
| Overview | Live inquiry totals, open pipeline, won project values, overdue tasks, stage counts, recent inquiries |
| Lead inbox | Search name/phone/email/location; filter stage, source, priority, owner and archive state; create inquiries; export filtered CSV |
| Sales pipeline | Eight stages, per-stage totals for the current page, cards that open editable lead details |
| Lead details | Contact information, project brief, owner, priority, estimated value, expected close, tags, loss reason and archive/restore |
| Activity | Staff-attributed notes, call/meeting logs, stage changes, follow-ups and proposal history |
| Follow-ups | Schedule, edit/reschedule, complete and reopen calls, meetings, visits and proposal follow-ups |
| Proposals | Line items, quantities, rupee amounts, configurable tax, scope/terms, validity, draft/sent/accepted/declined status, printable client copy |
| Reports | Recorded pipeline/won value, closed-deal win rate, source counts and inquiry-to-win percentages |
| Meta Lead Ads | Credential readiness, Page access check, Instant Form mapping/routing, import diagnostics, retry and historical import |
| Team & access | Create individual admin/manager/agent accounts; change roles; enable/disable access |
| Settings | Change your password and revoke all existing sessions |

Currency is INR; the API stores deal values and proposal totals in paise. Line items are rounded to paise, then the subtotal’s tax is rounded to paise. Proposal status is recorded by staff: marking “sent” does not send an email; “accepted” does not execute a contract. A saved proposal is a historical snapshot; create a new draft for a revised scope. Verify tax treatment before sharing. Browser Print / Save as PDF produces the client copy.

Call, email and WhatsApp links open the appropriate external application. Activity logging does not send anything. No email, SMS or WhatsApp sending account is connected. Existing optional website notification webhooks are separate from Meta lead retrieval.

## Team access and records

- **Admin:** all leads plus team and Meta configuration.
- **Manager:** all leads, assignments, archiving, tasks, proposals and reports; no team or Meta configuration.
- **Agent:** only leads currently assigned to that agent, including their related notes, tasks, proposals, reports and export. Agent-created leads are assigned to that agent. Unassigned website/Meta leads are visible to managers/admins until assigned.
- A task can be assigned to a manager/admin or the lead’s assigned agent. Assign the lead first if another agent should own the follow-up. Lead access takes precedence over an old task assignment after reassignment.
- Disabling or changing a teammate’s access revokes their sessions. Users can change their own passwords in Settings. Team accounts are created directly; no invitation email is sent.
- Lead edits check the record version. If another user saved first, the second save returns a conflict and asks for a refresh instead of overwriting their work.
- Phone/email matches are hints only; distinct project inquiries stay separate. Meta idempotency is based on the provider’s lead ID, not a person’s phone number.
- Archiving is reversible and excludes the record from normal dashboards and task lists. It is not privacy erasure.

If the administrator is locked out, run the recovery command on the host with `CRM_ADMIN_EMAIL` set to the existing administrator’s email:

```sh
npm run crm:setup -- --reset
```

A new random password is written to the private access file unless supplied through `CRM_ADMIN_PASSWORD`; all existing sessions for that administrator are revoked. Recovery does not create a new administrator or change a non-admin’s role. Use your host’s secure environment mechanism; avoid putting secrets directly into shell history.

## Connect Meta Lead Ads

This integration handles **Facebook/Instagram Instant Forms** delivered through a Facebook Page’s `leadgen` webhook. Leads appear under **Meta Ads Leads** (all roles; agents see only their assigned leads) and in the normal inbox/pipeline.

### One-time setup (Vercel)

| Variable | Purpose |
|---|---|
| `META_APP_ID` | Your Meta app ID (not secret) |
| `META_APP_SECRET` | Verifies webhook signatures, exchanges login codes, encrypts the stored Page token |
| `META_GRAPH_VERSION` | Optional, e.g. `v24.0` (default) |
| `META_PAGE_ID` | Optional: preselect this Page when the Facebook account manages several |

In the Meta app: add **Facebook Login** with the valid OAuth redirect URI `https://YOUR-HOST/api/crm/meta/oauth-callback`, add **Webhooks**, and set the app to Live (privacy policy `https://YOUR-HOST/privacy`).

Then, in CRM → **Meta setup**, an administrator clicks **Connect Facebook**, approves the Page permissions and (if several) picks the Page. The server then:

1. Exchanges the login for a long-lived Page token and stores it AES-GCM encrypted in MongoDB.
2. Subscribes the Page to the app’s `leadgen` field and registers `https://YOUR-HOST/api/meta/webhook` as the app’s Page webhook (the verify token is derived from the app secret, so nobody copies it).
3. Lists the Page’s Instant Forms and maps their questions automatically. Forms created later are registered the first time they receive a lead. Admins can still edit mappings, owners and pause forms.

**Sync now** re-imports the most recent 50 leads per form (duplicates are ignored). Use Meta’s Lead Ads Testing Tool to send a test lead and confirm it appears. `META_PAGE_ACCESS_TOKEN` + `META_PAGE_ID` in the environment still work and override the stored connection.

### Delivery and recovery

- Webhook POSTs require `X-Hub-Signature-256` with a valid HMAC-SHA256 over the exact body bytes. Only the configured Page ID is accepted.
- Accepted deliveries enter SQLite before HTTP acknowledgement. A unique provider lead ID prevents duplicate queue entries and duplicate CRM leads.
- One worker retrieves batches of 10, waking every 15 seconds and after deliveries/retries/imports. Temporary provider/network errors retry with exponential backoff, up to six attempts. Permanent permissions/mapping errors remain visible for staff review.
- Processing jobs become retryable after a process restart. An already saved lead is reused if a crash occurred before the job was marked imported.
- Map an unknown form or repair credentials, then press Retry on the failed job. A paused form retains its deliveries; enabling it does not automatically replay old failures without Retry.
- Original form answers, form ID/name, Page ID, ad ID, provider timestamp and custom disclaimer responses are retained. CRM edits do not rewrite the original answers. Campaign/ad-set names and ad spend are not inferred.
- A Meta submission is recorded as a contact-source statement, with advertising consent **not granted/not recorded**. Review the form’s notices and explicit responses before outreach.
- Secret values are never returned to the browser. Diagnostic errors avoid including Page access tokens or Graph response bodies.
- Historical imports follow Graph cursors on the fixed `graph.facebook.com` endpoint; returned arbitrary “next” URLs are not fetched.

Live Meta delivery remains **unverified** because no Meta app/Page credentials were supplied. Automated tests use synthetic signed events and a fake Graph adapter; no live leads, campaigns, business settings or ad budgets were changed.

## Production hosting and backups

Use one Node 24 process with a persistent local SQLite disk behind HTTPS. Serve the CRM and `/api` on the **same origin**; session cookies are HttpOnly, SameSite=Lax and Secure when `NODE_ENV=production`. Set `ALLOWED_ORIGINS` to exact trusted browser origins, including the CRM host. Do not use `*`. Set `TRUST_PROXY=1` only behind a proxy that overwrites forwarding headers and prevents direct public access to Node. The app does not encrypt its SQLite files; use host disk encryption and protected backups.

The GitHub Pages site can remain public and post to a separate API using `VITE_LEAD_API_URL`. Host the private CRM on the Node service’s origin, not on GitHub Pages with a cross-site session cookie. GitHub Pages alone cannot run this CRM backend or accept Meta webhooks.

```sh
npm run crm:backup
# Optional explicit destination, which must not already contain a file:
npm run crm:backup -- /secure/backups/srivardhan-2026-10-30.sqlite
```

The backup command uses SQLite `VACUUM INTO` to create a consistent snapshot while WAL is active. It includes users, leads, notes, proposals, tasks and Meta queue/configuration. Protect it as personal business data. Do not copy only the main live database file. Before restoring, stop the service, keep the existing database/WAL/SHM together as a recovery set, install the snapshot at `LEADS_DB` with restrictive permissions, remove stale WAL/SHM from the restored target, restart and verify record counts. Invalidate old sessions when restoring an older snapshot. Test restores and schedule encrypted off-host backups through the hosting platform.

The optional legacy bearer endpoints remain for compatibility and authorized privacy erasure. Leave `ADMIN_TOKEN` blank unless specifically needed. Their access is unrestricted across leads and bypasses individual roles; do not give this shared token to agents. `DELETE /api/leads/:id` removes the lead and related activity/tasks/proposals/audit records. Meta delivery IDs remain as deduplication tombstones so a webhook replay cannot silently recreate erased contact data. Backups follow a separate retention policy.

## Limits and further integrations

This is a complete local sales workflow for the studio, not a deployed enterprise CRM service. One Facebook Page is configured per installation, with multiple mapped forms. Lead lists/pipeline paginate at 100 records; CSV export is capped at 10,000 matching records and asks you to narrow filters if exceeded. Follow-ups show the first 1,000 records with open tasks first; individual lead details retain all related tasks. Import diagnostics show the latest 100 jobs, with all jobs retained in SQLite. Reporting and contact matching are designed for a small team; use grouped/indexed queries and a shared database/job lease before scaling to very large datasets or multiple server instances.

No billing, stock, payroll, e-signatures, WhatsApp Business messaging, inbox synchronization, Meta ad creation/spend management, SSO/MFA or automatic closed-won feedback to Meta is implied. These require separate product decisions and provider accounts. The CRM’s implemented features work locally without those integrations.
