import { readFile, writeFile, mkdir } from "node:fs/promises";
import { render, pageRoutes, pageMeta, brand } from "../.ssr/entry-server.js";
const template = await readFile("dist/index.html", "utf8");
const base = process.env.SITE_BASE_PATH || "/vardhanproject/";
const origin = (process.env.SITE_URL || brand.site).replace(/\/$/, "") + "/";
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const schema = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: brand.name,
  url: origin,
  telephone: brand.telephone,
  email: brand.email,
  areaServed: { "@type": "City", name: "Vijayawada" },
  logo: `${origin}logo.png`,
  sameAs: [brand.instagram],
};
for (const route of [...pageRoutes, "admin/", "404/"]) {
  const meta = pageMeta(route);
  const noindex = route === "admin/" || route === "404/";
  const head = `<link rel="canonical" href="${escape(origin + route)}"/><meta property="og:type" content="website"/><meta property="og:title" content="${escape(meta.title)}"/><meta property="og:description" content="${escape(meta.description)}"/><meta property="og:url" content="${escape(origin + route)}"/><meta property="og:image" content="${origin}images/living-1200.webp"/><meta name="twitter:card" content="summary_large_image"/>${noindex ? '<meta name="robots" content="noindex,nofollow"/>' : ""}<link rel="preload" href="${base}fonts/editorial.woff2" as="font" type="font/woff2" crossorigin/><script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>`;
  const html = template
    .replace(/<title>.*?<\/title>/s, `<title>${escape(meta.title)}</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${escape(meta.description)}"/>`,
    )
    .replace("<!--head-->", head)
    .replace("<!--app-->", render(route));
  const dir = `dist/${route}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}index.html`, html);
  if (route === "404/") await writeFile("dist/404.html", html);
}
await writeFile(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pageRoutes
    .filter((p) => !p.startsWith("consult/"))
    .map((p) => `<url><loc>${escape(origin + p)}</loc></url>`)
    .join("")}</urlset>`,
);
await writeFile(
  "dist/robots.txt",
  `User-agent: *\nAllow: /\nDisallow: ${base}admin/\nSitemap: ${origin}sitemap.xml\n`,
);
await writeFile("dist/.nojekyll", "");
console.log(
  `Prerendered ${pageRoutes.length + 2} pages with unique metadata and static content.`,
);
