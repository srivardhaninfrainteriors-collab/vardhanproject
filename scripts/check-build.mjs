import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
const base = process.env.SITE_BASE_PATH || "/vardhanproject/";
async function walk(dir) {
  let out = [];
  for (const item of await readdir(dir)) {
    const p = join(dir, item);
    if ((await stat(p)).isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
const files = (await walk("dist")).filter((p) => p.endsWith(".html"));
const titles = new Set();
let links = 0;
for (const file of files) {
  const html = await readFile(file, "utf8");
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  assert.ok(title, file + " has title");
  if (!file.endsWith("404.html")) {
    assert.ok(!titles.has(title), "unique title: " + title);
    titles.add(title);
  }
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, file + " has one H1");
  assert.ok(html.includes('rel="canonical"'), file + " canonical");
  assert.ok(!html.includes("Learn React"));
  assert.ok(!html.includes("123 Construction Street"));
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const href = match[1].split("#")[0].split("?")[0];
    if (!href.startsWith(base)) continue;
    const local = join("dist", decodeURIComponent(href.slice(base.length)));
    assert.ok(
      existsSync(local) || existsSync(join(local, "index.html")),
      `${file}: broken asset/link ${href}`,
    );
    links++;
  }
  for (const match of html.matchAll(/<img\b[^>]*>/g))
    assert.ok(/alt=/.test(match[0]), file + " image alt");
}
assert.ok(existsSync("dist/sitemap.xml"));
assert.ok(existsSync("dist/robots.txt"));
console.log(
  `Checked ${files.length} HTML documents, ${links} internal links/assets, unique titles, canonical tags, headings and image alternatives.`,
);
