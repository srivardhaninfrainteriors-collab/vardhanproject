# Audit and creative direction

## Existing site and architecture

The supplied public site was retrieved successfully on 26 October 2026. The repository contains three React scaffolds and static company content inside HTML. The root had `react-scripts@^0.0.0`, which cannot build the application. The active company page was embedded in `public/index.html`, outside React. Existing navigation hides on mobile without usable menu styles, and project content links to unrelated third-party images.

Keep React and the repository. Replace the broken build pipeline with Vite, prerender actual routes, and retain GitHub Pages compatibility. CSS and IntersectionObserver provide the requested restrained motion without GSAP or scroll hijacking. SQLite plus Node's standard HTTP library provide an independently deployable lead API. Production requires a host with persistent storage; GitHub Pages only hosts the generated frontend.

## Original identity

`public/logo.png` is the original 647 × 385 RGBA logo, used unchanged. Pixel analysis of opaque, non-dark pixels found the dominant RGB value (201,168,114), hexadecimal **#C9A872** (4,234 exact matching pixels). Adjacent raster shades include #C8A771 and #C7A872. The older stylesheet's blue #2A5C82 and yellow #F9A825 did not reflect this logo and are not the foundation of the new design.

Tokens in `src/styles.css`:

| Token | Value | Purpose |
|---|---|---|
| brand | #C9A872 | Exact dominant logo tone, buttons and accents |
| brand-deep | #806338 | Accessible darker supporting accent on light surfaces |
| brand-pale | #E9DCC7 | Supporting light accent |
| ink | #242620 | Neutral charcoal text and dark surfaces |
| paper | #F8F6F1 | Warm ivory page background |
| stone | #EEECE5 | Alternating editorial sections |
| muted | #68695F | Secondary body text |
| line | #D9D7CE | Fine dividers |

The supplied logo is not recoloured, traced, cropped or distorted. Adjacent typeset company identification is separate from the logo image. Cormorant Garamond and Manrope provide the display/sans pairing, with local WOFF2 fonts and licences included. Photography is graded with restrained overlays. The layout uses large asymmetric imagery, generous spacing, a compact header, serif headlines and minimal rules rather than icon cards or decorative effects.

## Fact handling

Preserved published phone numbers: +91 9052230160 and +91 6301997874. Preserved email: myvardhanrao@gmail.com. Preserved Instagram account: srivardhan_interiors_vija. The user's brief establishes Vijayawada and the service categories. These sources do not independently verify ownership of the contacts; the owner should confirm them before launch.

Omitted: the apparent template address “123 Construction Street, Hyderabad”, the unsupported 25+ years claim, CREDAI/RERA claims and GST identifier pending verification. The old gallery linked to ArtStation, travel/hotel sites and other architecture sources; it is not reliable evidence of company work. No project names, locations, reviews, awards, ratings, statistics, team biographies or delivery guarantees were invented.

The proposed discovery-to-handover journey is explicitly subject to the agreed project scope. Services describe discussions and scope options rather than unsupported certifications or fixed delivery promises. Reference imagery is labelled in the gallery, study pages and hero. No genuine case studies are published until approved material arrives.

## Sitemap and conversion architecture

Home → Studio / Expertise / Work & Inspiration / Journal / Contact.

Expertise → luxury interior design; premium home interiors; residential construction; villas; commercial interiors/construction; office/retail fit-outs; renovation/remodelling; builder/developer partnerships.

Work → filterable reference gallery → individual inspiration studies. A separate `projects` content collection supports genuine case-study routes once evidence is supplied.

Journal → preparation; material selection; construction planning. Further categories can be added to the data collection.

Campaigns → three focused funnels with reduced navigation and context-specific forms. All main CTAs lead to the consultation page or the local inquiry section. Mobile has persistent WhatsApp and consultation actions. Phone and WhatsApp are real links to the published contact.

No rating/testimonial module is displayed without genuine content. The confidence section instead gives useful, factual consultation guidance.
