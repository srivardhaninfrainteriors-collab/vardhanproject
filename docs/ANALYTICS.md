# Analytics and conversion testing

All providers are **unconfigured by default**. Code presence is not verification of an integration. There are no tracking scripts loaded before the visitor grants the relevant optional consent. No real ads, spend, pixels or accounts were created.

## Configuration

Public build settings:

- `VITE_GA4_ID`: Google Analytics measurement ID.
- `VITE_GTM_ID`: optional Tag Manager container. When set, direct Google tag loading is suppressed. Configure Google tags inside GTM instead of running both paths.
- `VITE_GOOGLE_ADS_ID` and `VITE_GOOGLE_ADS_CONVERSION_LABEL`: direct Google Ads lead conversion (without GTM).
- `VITE_META_PIXEL_ID`: browser Meta Pixel. If used, do not also install the same Pixel in GTM.

Server-only settings: `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_GRAPH_VERSION` (a currently supported version from Meta documentation), optional `META_TEST_EVENT_CODE`. CAPI only runs for stored leads whose visitor selected marketing consent. It uses the same stored ID as the browser Pixel's `eventID`. The server hashes the supplied phone digits for matching; request international country codes in production if relying on Meta match quality. There is no claim of verified event matching without an actual account test.

Cookie preferences separately control analytics and marketing. Consent is stored in localStorage; campaign attribution is retained in sessionStorage only after measurement consent, so navigation to the consultation page preserves the campaign. Rejecting both removes stored attribution. Revoking consent reloads the page without the optional scripts; providers may still retain their own existing cookies under their retention policies.

GTM installations must implement the consent settings inside their container and respect the consent default issued before the container loads. Do not publish tags configured to bypass consent. Analytics-only selection must not run advertising tags. Site code keeps personal form fields out of browser measurement payloads.

## Events

| Event | Meaning |
|---|---|
| `landing_page_view` | Page loaded with measurement consent; includes pathname |
| `consultation_request` | Consultation CTA clicked; not a submitted lead |
| `click_to_call` | Telephone link clicked; not a connected call |
| `whatsapp_click` | WhatsApp opened; not a delivered message |
| `generate_lead` | Backend confirmed durable storage; includes event ID, selected service and campaign |
| Meta `Lead` | Same confirmed lead ID in browser/server for deduplication |
| Google Ads conversion | Confirmed lead, transaction ID = saved lead ID |

Campaign routes identify interiors, construction and partners. UTM source, medium, campaign, content and term are retained with the inquiry when permitted. No successful lead event is generated for validation failures, server failures or WhatsApp preparation.

## Test procedure after credentials are available

1. Use a test property/pixel or provider test-event mode; clearly mark the inquiry as testing.
2. With a new browser profile, reject optional cookies. Verify no Google/Meta script requests, no campaign storage and no lead event. A necessary form submission should still save.
3. Grant analytics only. Verify GA4 DebugView/Tag Assistant page and CTA events; confirm marketing remains denied and Meta does not load.
4. Grant marketing separately. Verify the configured pixel loads once, and tags follow Google consent settings. In GTM, check preview mode before publishing the container.
5. Visit a campaign page with UTM parameters, navigate to consultation and submit. Verify one stored inquiry with attribution and one deduplicated lead conversion. No names, phones or messages should appear in browser event payloads.
6. Submit invalid fields, leave consent unchecked, simulate backend failure and repeat an identical request. Verify no false success event; retry must return the original lead ID without another row.
7. In Meta Events Manager, verify browser and CAPI events have identical event name/ID and deduplicate. Verify Google Ads receives the expected conversion action and transaction ID. Check provider diagnostics, not merely HTTP status.
8. Disable the webhook receiver. The lead must remain accessible while notification status shows failure. Restore the receiver and verify the downstream CRM/message manually with a new test inquiry.
9. Change Cookie preferences to essential only, reload and verify optional scripts are absent.
10. Delete only the labelled test leads through authorised access after confirming the run. Record dates, provider IDs and evidence in the release checklist.

## A/B testing roadmap

Use a first-party experiment or your chosen analytics platform after consent and baseline measurement are validated. Keep campaign targeting and budget comparable. Avoid automatic winner claims from small samples.

| Priority | Test | Primary measure | Guardrail |
|---|---|---|---|
| 1 | Vision-led hero vs practical planning-led hero | Qualified leads per consented landing visit | Form abandonment and lead quality |
| 2 | “Book a Private Consultation” vs “Discuss Your Project” | Confirmed lead rate | Call/WhatsApp clicks tracked separately |
| 3 | Current two-step form vs shorter initial inquiry | Qualified lead completion | Missing project information and spam |
| 4 | Interior gallery before vs after scope explanation | Qualified interior inquiries | Page speed and mobile completion |
| 5 | Construction funnel with approved site proof | Qualified site consultations | Never substitute stock imagery for site work |

Predefine hypothesis, audience, sample target and duration. Review new → qualified → site visit → won progression in the lead desk, not just clicks. No experiment is active in this release.

## Documentation references

- https://developers.google.com/tag-platform/security/guides/consent
- https://vite.dev/guide/static-deploy.html
- https://nodejs.org/api/sqlite.html

Provider credentials, dashboard verification and actual field Core Web Vitals are still required before claiming production integration or performance targets.
