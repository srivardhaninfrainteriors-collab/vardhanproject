# Verification record — 26 October 2026

## Automated checks completed

- Production client build and prerender passed: 28 route directories plus the standalone GitHub Pages 404 file, 29 HTML documents total.
- Static checks validated 1,347 internal links/asset references, one H1 per document, unique route titles, canonical tags, image alternatives, sitemap and robots output.
- Native Node test suite passed boundary validation, consent rejection, malformed input, honeypot, stored lead creation, idempotent retries, request-ID conflicts, origin restrictions, staff authentication, pagination, all eight status updates, invalid status rejection, persistence after server restart, rate limiting and authorised deletion.
- Original logo Git object hash is unchanged from HEAD.
- Production dependency audit: zero known vulnerabilities at verification time.
- Git whitespace check passed.

## Browser checks completed

Using the in-app browser against the local dev and production builds:

- Desktop homepage composition at 1440 px; phone homepage at 390 px.
- Layout width checks at 320, 768 and 1440 px on the partnership campaign: document width matched viewport width. The offscreen honeypot is intentionally outside the viewport and does not create horizontal scrolling.
- Mobile full-screen menu opens, Escape closes it, and focus returns to its trigger.
- Gallery Commercial filter displays the matching reference study.
- ArrowRight on the Discovery tab selects Consultation and updates the process panel.
- Two-step form advances, focuses project location, validates required fields and preserves the selected service.
- A labelled local QA inquiry was genuinely saved with a returned reference. No real message was sent to the business.
- Production partnership funnel preselects the correct service and exposes the organisation field and construction-scale budget options.
- Production without an API prepares a correctly encoded WhatsApp message and explicitly states it has not been submitted. The WhatsApp send action was not performed.
- The production page loads only the first-party application script when no analytics providers are configured.
- The initial development hydration mismatch caused by treating a comment as rendered content was fixed by checking for a real root element before hydration.

## Performance measures and limits

The production application is approximately 75 KB gzip plus 7.4 KB gzip CSS; the staff lead desk is a separate approximately 1.3 KB gzip chunk. Local WOFF2 font files replace approximately 660 KB of TTF fonts. Images have local 640/1200-pixel WebP variants, plus a 2000-pixel hero version; below-the-fold images are lazy loaded, hero priority is explicit and image dimensions are reserved. Public routes are prerendered for readable initial HTML and SEO.

No claim is made that field LCP ≤ 2.5 s, INP ≤ 200 ms or CLS ≤ 0.1 has been achieved. These require a deployed origin, representative devices/network conditions and real-user data at the 75th percentile. Run PageSpeed Insights/Lighthouse on the production URL, then review Search Console/CrUX once field data exists. No comprehensive independent WCAG audit has been performed; keyboard, reduced-motion styling, focus visibility, labels, contrast-oriented colours, modal behaviour and responsive layouts have been implemented and key interactions checked.

## Not verified or activated

- No real CRM/webhook receiver, email/WhatsApp notification account, GA4/GTM/Google Ads account, Meta Pixel or CAPI token was supplied. Their live delivery and provider diagnostics have not been verified.
- No production API host or staff secret is configured. The static build has a real WhatsApp handoff; local API storage was tested separately.
- No genuine company projects, testimonials, team biographies or credentials were supplied. Reference imagery remains labelled; verified case studies are intentionally unpublished.
- No GitHub push or production deployment was performed.
