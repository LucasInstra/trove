// Measures the performance budget against dist/. Run after `npm run build`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = walk(dist);
const size = (f) => statSync(f).size;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const js = files.filter((f) => f.endsWith(".js"));
const fonts = files.filter((f) => f.endsWith(".woff2"));
console.log(`JS files in dist: ${js.length}`);
console.log(`Fonts: ${fonts.length} files, ${kb(fonts.reduce((a, f) => a + size(f), 0))} (budget: 2 files, under 150 KB)`);

const html = readFileSync(join(dist, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
console.log(`<script> tags on home: ${scripts.length} (${scripts.map((s) => (s.includes("ld+json") ? "ld+json" : "OTHER")).join(", ") || "none"})`);

// First fold: HTML + the hero AVIF actually chosen at 900px + the two preloaded fonts.
const heroAvif = [...html.matchAll(/srcset="([^"]+)"/g)]
  .map((m) => m[1])
  .find((s) => s.includes("overview-light") && s.includes(".avif"));
const urls = heroAvif ? [...heroAvif.matchAll(/(\/[^\s,]+\.avif)\s+(\d+)w/g)] : [];
console.log("Hero AVIF candidates:", urls.map((m) => `${m[2]}w`).join(", ") || "none found");
let hero = 0;
for (const m of urls) {
  const f = files.find((x) => x.replace(/\\/g, "/").endsWith(m[1].replace(/^\/trove/, "")));
  if (f) console.log(`  ${m[2]}w = ${kb(size(f))}`);
  if (f && m[2] === "1800") hero = size(f);
}
const total = Buffer.byteLength(html) + fonts.reduce((a, f) => a + size(f), 0) + hero;
console.log(`First fold (home HTML + fonts + hero AVIF 1800w, the largest case): ${kb(total)} (budget: under 400 KB)`);
