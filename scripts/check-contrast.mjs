// Contrast of the text/background pairs the app actually uses, computed from
// src/styles/tokens.css. Floor: 4.5:1 for text up to 18px.
// Usage: node scripts/check-contrast.mjs   (exit code 1 when a pair fails)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("../src/styles/tokens.css", import.meta.url)), "utf8");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`block not found: ${selector}`);
  return css.slice(start, css.indexOf("\n}", start));
}

function vars(text) {
  const out = {};
  for (const m of text.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const light = vars(block(":root"));
const dark = { ...light, ...vars(block('[data-theme="dark"]')) };

const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text token, background token, label]
const pairs = [
  ["--ink", "--surface", "body text on card"],
  ["--ink", "--bg", "body text on window"],
  ["--ink", "--paper", "text on paper band"],
  ["--muted", "--surface", "secondary text on card"],
  ["--muted", "--bg", "secondary text on window"],
  ["--muted", "--paper", "secondary text on paper"],
  ["--faint", "--surface", "metadata on card"],
  ["--faint", "--bg", "metadata on window"],
  ["--faint", "--surface-soft", "metadata on soft surface"],
  ["--faint", "--paper", "metadata on paper"],
  ["--primary", "--surface", "link / eyebrow on card"],
  ["--primary", "--bg", "link on window"],
  ["--primary", "--primary-soft", "primary on tint"],
  ["--primary-strong", "--primary-soft", "active nav item"],
  ["--primary-foreground", "--primary", "primary button label"],
  ["--positive", "--surface", "income figure"],
  ["--negative", "--surface", "expense figure"],
  ["--warning", "--surface", "due soon"],
  ["--hero-band-text", "--hero-band", "anchor card text"],
  ["--anchor-muted", "--hero-band", "anchor card secondary"],
  ["--anchor-faint", "--hero-band", "anchor card metadata"],
  ["--anchor-positive", "--hero-band", "anchor card gain"],
  ["--anchor-negative", "--hero-band", "anchor card loss"],
];

let failed = 0;
for (const [name, tokens] of [["light", light], ["dark", dark]]) {
  console.log(`\n${name}`);
  for (const [fg, bg, label] of pairs) {
    // In the dark theme the anchor card sits on --surface-soft, not on the band.
    const bgToken = name === "dark" && bg === "--hero-band" ? "--surface-soft" : bg;
    const value = ratio(tokens[fg], tokens[bgToken]);
    const ok = value >= 4.5;
    if (!ok) failed += 1;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${value.toFixed(2).padStart(5)}:1  ${fg} on ${bgToken}  (${label})`,
    );
  }
}
console.log(failed ? `\n${failed} pair(s) below 4.5:1` : "\nall pairs >= 4.5:1");
process.exit(failed ? 1 : 0);
