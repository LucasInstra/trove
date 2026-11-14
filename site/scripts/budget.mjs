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
console.log(`Fonts: ${fonts.length} files, ${kb(fonts.reduce((a, f) => a + size(f), 0))} (budget: 3 files, under 150 KB; the third is the handwritten face)`);

const html = readFileSync(join(dist, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
console.log(`<script> tags on home: ${scripts.length} (${scripts.map((s) => (s.includes("ld+json") ? "ld+json" : "inline")).join(", ") || "none"})`);

// First fold on a wide screen: the home HTML, all three fonts (the polaroid captions use
// Gloria) and the images marked eager. Polaroids are lazy, so they only count if that changes.
const eager = [...html.matchAll(/<img\b[^>]*>/g)]
  .map((m) => m[0])
  .filter((tag) => /loading="eager"/.test(tag))
  .map((tag) => /src="([^"]+)"/.exec(tag)?.[1])
  .filter(Boolean)
  .map((src) => files.find((f) => f.replace(/\\/g, "/").endsWith(src.replace(/^\/trove/, ""))))
  .filter(Boolean);
const total = Buffer.byteLength(html) + fonts.reduce((a, f) => a + size(f), 0) + eager.reduce((a, f) => a + size(f), 0);
console.log(`First fold (home HTML + ${fonts.length} fonts + ${eager.length} eager images): ${kb(total)} (budget: under 400 KB)`);
