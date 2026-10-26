# Deployment and maintenance

## Static frontend on GitHub Pages

1. Review the site locally and confirm the business information.
2. Commit and push the root application changes when approved for release.
3. In repository Settings → Pages, select GitHub Actions as the source.
4. Run **Deploy website to GitHub Pages** manually from Actions. The workflow runs tests, builds and checks the generated site before publishing `dist/`.
5. Check the workflow's deployed URL and test the contact path on the actual domain.

The workflow is deliberately manual. No push, commit or production deployment has been made by this implementation task. Historic `base` and `frontend` directories are not built.

The default base is `/vardhanproject/`. For another host or a custom root domain, set `SITE_BASE_PATH=/` and `SITE_URL=https://your-real-domain/` for **both** build stages and rerun the build. Canonical URLs and sitemap use `SITE_URL`. Build-time values must be set in the shell or workflow environment; `SITE_BASE_PATH` and `SITE_URL` are not automatically read from `.env` by the prerender script.

## Two honest contact modes

**No API configured:** the production form prepares a WhatsApp message. The visitor explicitly opens WhatsApp and sends it. The site says the inquiry is prepared, never saved or delivered. Business staff receive messages through the published WhatsApp account. Clicks are not recorded as submitted leads.

**API configured:** set the public build variable `VITE_LEAD_API_URL=https://your-api-host/api` (no trailing slash), or `/api` if the frontend and service share a host. On GitHub Actions, set repository variable `LEAD_API_URL`. The site sends JSON to `/leads` and confirms only when storage returns a real ID. There is no silent fallback after a failed request; visitors can retry safely or use the visible telephone/WhatsApp options.

## Deploy the lead service

Use a Node 24 host with a **persistent disk**, HTTPS and backups. A single instance with SQLite is appropriate for this small-business lead workflow. Do not put the database on an ephemeral/serverless filesystem or scale independent SQLite instances. Move to a shared managed database if deployment or traffic requires multiple instances.

1. Install root dependencies and build the site if serving it from this process.
2. Configure server-only environment values from `.env.example`. Set `NODE_ENV=production`, a random `ADMIN_TOKEN` of at least 32 characters, `ALLOWED_ORIGINS` to exact frontend origins (e.g. `https://srivardhaninfrainteriors-collab.github.io`), and `LEADS_DB` to the persistent disk path.
3. Run `npm run server` under the host's process supervisor. Set `HOST=0.0.0.0` only where the hosting platform requires it; terminate HTTPS at the trusted reverse proxy. The default local port is 8791.
4. Check `/api/health`. Connect the frontend, rebuild, and submit a clearly labelled test inquiry.
5. At `/vardhanproject/admin/`, enter the staff token and verify the lead. Keep tokens in a password manager. The desk does not store them in localStorage or URLs. Sign out or reload when finished.
6. Only set `TRUST_PROXY=1` if the immediate proxy overwrites `X-Forwarded-For` and prevents direct access to the backend. Otherwise keep it disabled.

Server endpoints:

| Method | Route | Access / purpose |
|---|---|---|
| GET | `/api/health` | Health status |
| POST | `/api/leads` | Validated inquiry; consent required; unique request ID; honeypot and rate limits |
| GET | `/api/leads` | Staff bearer token; newest leads |
| PATCH | `/api/leads/:id` | Staff token; update status |
| DELETE | `/api/leads/:id` | Staff token; erase a lead and its status history after an authorised privacy request |

Status workflow: new → contacted → qualified → site visit → proposal → negotiation → won/lost. Staff can correct a status in either direction. Updates are recorded in the audit table. Do not mark a lead won merely because a proposal was sent.

## CRM and notifications

`LEAD_WEBHOOK_URL` is an optional HTTPS receiver supporting the documented JSON event `{event:'lead.created', id, ...inquiry}`. `LEAD_WEBHOOK_SECRET` supplies an optional bearer token. The receiver can be an approved CRM adapter or a business-controlled workflow that sends email/WhatsApp notifications. Never put this secret in a `VITE_` variable.

Delivery state is `not_configured`, `pending`, `delivered` (receiver returned 2xx) or `failed`. The lead is saved before notification begins, so receiver failure does not discard inquiries. A webhook's 2xx is not proof a downstream email or WhatsApp message reached a person. No direct email or WhatsApp notification account has been connected. Failed or pending delivery after a process interruption needs staff review; there is no unattended retry queue. The lead desk remains the authoritative record.

## Maintenance

- Restrict persistent disk permissions and use encrypted storage and encrypted backups on the host. SQLite is not encrypted by this application.
- Back up via SQLite's backup mechanism or a host snapshot consistent with WAL, then test a restore. Do not copy only the main database while writes are active.
- Define retention with the business; review dormant leads and fulfil access/deletion requests through authorised staff. Deletion from backups follows the backup retention policy.
- Rotate the staff token after staff changes. A shared token is the deliberate small-team implementation; add named accounts/MFA through a real identity provider when staff access needs individual attribution.
- Check failed notifications, service health, storage space, broken external links and form delivery regularly.
- Update dependencies through reviewed changes and rerun `npm test`, `npm run build` and `npm run check`.
- Keep content updates in Git and deploy the previous successful version to roll back the frontend. Back up the database before server/schema changes.

## Launch dependencies

No live API destination, CRM webhook, staff secret, analytics IDs or CAPI token was supplied. Production direct submissions and notifications remain unconfigured until these are provided. The static WhatsApp path works without them. Verify the privacy/terms text, retention practice, contact ownership and all future portfolio claims with the business before public release.
