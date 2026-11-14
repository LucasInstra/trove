// Drives the preview through Chrome DevTools: enters layout edit mode, drags the
// right resize handle of a card and writes screenshots. Usage: node cdp-resize.mjs <cardId> <dx> <outDir>
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const [cardId = "cards", dxArg = "400", outDir = "."] = process.argv.slice(2);
const dx = Number(dxArg);
mkdirSync(outDir, { recursive: true });
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = 9333;
const proc = spawn(chrome, [
  "--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`,
  "--window-size=1280,900", "--user-data-dir=" + outDir + "/profile", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i += 1) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {}
  await sleep(250);
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) pending.get(d.id)(d.result); };
const send = (method, params = {}) => new Promise((r) => { id += 1; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.value;
const shot = async (name) => {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(data, "base64"));
};
const mouse = (type, x, y) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, pointerType: "mouse" });

await send("Page.enable");
await send("Page.navigate", { url: "http://localhost:1421/?route=overview&theme=light&layout=" + encodeURIComponent(process.env.LAYOUT ?? "cards:1") });
await sleep(3500);
await evalJs(`document.querySelector('button.layout-toggle')?.click()`);
await sleep(600);
const rect = JSON.parse(await evalJs(`JSON.stringify((()=>{const h=document.querySelector('[data-card="${cardId}"] .cell-resize-handle.is-right'); if(!h) return null; const r=h.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})())`));
if (!rect) { console.log("no handle"); proc.kill(); process.exit(1); }
const spanOf = () => evalJs(`document.querySelector('[data-card="${cardId}"]').className`);
console.log("before:", await spanOf());
await mouse("mouseMoved", rect.x, rect.y);
await mouse("mousePressed", rect.x, rect.y);
const steps = 20;
for (let i = 1; i <= steps; i += 1) { await mouse("mouseMoved", rect.x + (dx * i) / steps, rect.y); await sleep(30); }
await sleep(400);
console.log("during:", await spanOf());
console.log("guides:", await evalJs(`(()=>{const g=document.querySelector('.resize-guides'); if(!g) return 'none'; const r=g.getBoundingClientRect(); const c=getComputedStyle(g); return JSON.stringify({w:r.width,h:r.height,pos:c.position,cols:c.gridTemplateColumns,z:c.zIndex,kids:g.children.length,gridPos:getComputedStyle(g.parentElement).position})})()`));
await shot("during");
await mouse("mouseReleased", rect.x + dx, rect.y);
await sleep(800);
console.log("after:", await spanOf());
await shot("after");
console.log("saved:", await evalJs(`(window.__saved ?? '')`));
proc.kill();
process.exit(0);
