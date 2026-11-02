# SRIVARDHAN INFRA & INTERIORS

A responsive, editorial architecture and interiors website built in the existing repository. React remains the UI framework. Vite replaces the root's unusable `react-scripts@0.0.0`; a small prerender step makes every public route a real HTML document suitable for GitHub Pages. No Next.js backend is implied on static hosting.

## Run locally

Node 24+ is required for the native SQLite lead service.

```sh
npm ci
npm run build
npm run crm:setup # first run only; creates private local sign-in details
npm run server
# In a second terminal:
npm run dev
```

Open `http://127.0.0.1:5173/vardhanproject/`. Development inquiries use the local service on port 8791. Submitted data is in ignored `data/leads.sqlite`; do not use real personal data for QA. No notifications or advertising integrations are enabled by default.

```sh
npm test          # validation, persistence, authentication, status workflow, rate limits
npm run build    # client bundle + full HTML for every route + sitemap
npm run check    # page metadata, headings, asset and internal-link checks
npm run preview  # production build at http://127.0.0.1:4173/vardhanproject/
```

Open the CRM at `http://127.0.0.1:8791/vardhanproject/crm/`. The Node server connects website forms to the CRM automatically. Static-only production builds without `VITE_LEAD_API_URL` use an explicit WhatsApp handoff. They never say a message was delivered just because WhatsApp was opened. With an API endpoint configured, success appears only after durable storage returns a reference.

## Included

- Cinematic homepage, studio, eight differentiated service pages, gallery with filters, four clearly labelled inspiration studies, three journal articles, contact and legal pages.
- Three focused campaign routes: `consult/interiors/`, `consult/construction/`, `consult/partners/`.
- Two-step qualification form, consent, contextual service selection, conditional partnership field and budget options.
- Full sales CRM at `crm/` (also `admin/`): individual sign-in, role-based access, dashboard, searchable leads, pipeline, follow-ups, notes, printable proposals, reports, team controls and CSV export.
- Meta Lead Ads adapter: signed webhook intake, Page restriction, form mapping, owner routing, original answers, idempotency, durable retries, diagnostics and historical imports. Live connection requires Meta credentials.
- SQLite persistence, version-checked lead edits, archival, backup/recovery commands, rate limits, public-form consent validation and honeypot.
- Consent-controlled GA4 / GTM / Google Ads / Meta Pixel adapters, optional Meta CAPI and CRM notification webhook.
- Original logo unchanged, self-hosted fonts, responsive WebP imagery, reduced-motion support, keyboard navigation and native modal menu.
- Prerendered metadata, canonical and Open Graph tags, business structured data, sitemap, robots and GitHub Pages deployment workflow.

## Documentation

- [CRM usage, account setup, Meta Lead Ads and backups](docs/CRM.md)

- [Audit, creative direction and factual limits](docs/AUDIT-AND-DESIGN.md)
- [Content editing and image provenance](docs/CONTENT.md)
- [Deployment, leads and maintenance](docs/OPERATIONS.md)
- [Analytics setup, testing and experimentation](docs/ANALYTICS.md)
- [Verification results](docs/VERIFICATION.md)

The historical `base/`, `frontend/` and `base.html` files are preserved but are **not active application sources**. Make changes at the repository root. Only `dist/` is published. Do not deploy `public/` or the historical folders.

## Still required from the business

Client-approved project photos/case studies, verified team/credential/testimonial information, confirmation of published contact details, a persistent HTTPS hosting destination, and Meta app/Page and advertising credentials. These are not invented or silently activated. The supplied brief confirms Vijayawada as the target market; no street address is claimed.
