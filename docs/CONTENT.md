# Content management

## Simple, reviewable editing

`src/content.js` is the source of truth for the brand contact information, service pages, FAQs, inspiration studies, journal, workflow and campaign copy. Edit it locally or with GitHub's file editor, review the diff, run the checks and deploy. No CMS account or subscription is needed. This is file-based content management, not a hosted visual CMS.

Each service has a unique `slug`, `name`, hero `title`, `intro`, `scope`, `benefit` and `faq` array. Keep slugs stable; if changing one, add a redirect page before removing the previous URL. Service names are also validated by the backend's explicit allowlist in `server/index.mjs`; update it when adding or renaming services.

To add a journal story, add an object to `journal` with `slug`, `title`, `category`, `image`, `intro`, and `paragraphs` (pairs of heading and body). Its route, metadata and sitemap entry are generated automatically.

## Publishing genuine projects

The `projects` collection is intentionally empty. Add an entry only when the business has verified the details and has permission to publish all images:

```js
{
  slug: 'approved-project-slug',
  title: 'Owner-approved project title',
  location: 'Verified location (respect client privacy)',
  scope: 'Verified scope',
  summary: 'Factual project summary',
  cover: 'images/approved-project-cover.webp',
  sections: [
    { title: 'The brief', text: 'Verified client brief.' },
    { title: 'The response', text: 'Actual design and execution decisions.' }
  ]
}
```

Place approved images in `public/images/`. Rebuild to create the case-study route and gallery listing. Do not relabel inspiration images as completed work. Where privacy restricts publication, omit identifying information rather than inventing details.

For a future visual CMS, map these same fields to a Git-backed editor or a headless CMS after choosing its provider and authentication. Do not add a publicly writable content endpoint.

## Image provenance

Reference photos are downloaded from Unsplash's image service, converted to responsive WebP derivatives, and labelled as reference photography rather than business work. They are not factual case studies. Retain this distinction when replacing assets.

| Local prefix | Source |
|---|---|
| living | https://images.unsplash.com/photo-1600210492486-724fe5c67fb0 |
| detail | https://images.unsplash.com/photo-1600607687939-ce8a6c25118c |
| villa | https://images.unsplash.com/photo-1613977257363-707ba9348227 |
| office | https://images.unsplash.com/photo-1497366754035-f200968a6e72 |

Original logo: the repository's `public/logo.png`. Fonts: Google Fonts Cormorant Garamond and Manrope, redistributed with their OFL licence files in `public/fonts/`. Do not modify the logo palette, aspect ratio or internal layout.

## Asset checklist

For each authentic project obtain permission, title, location disclosure level, scope, before/after context where real, approved caption, and rights to photographs. For testimonials obtain exact approved wording, attribution and permission. For credentials obtain current documentary evidence and approved wording. Publish only actual team identities and roles.
