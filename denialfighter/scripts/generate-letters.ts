/**
 * Generates the synthetic corpus in fixtures/letters: <id>.pdf (text layer), <id>.png (phone-photo look, for some),
 * <id>.truth.json (ground truth) and <id>.ocr.txt (simulated OCR text for the photo variants).
 * Run: CHROMIUM_PATH=/path/to/chrome npx tsx scripts/generate-letters.ts
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { LETTERS, letterText, truth } from "../fixtures/letters";

const OUT = "fixtures/letters";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const page = (text: string, photo: boolean) => `<!doctype html><html><body style="margin:0;background:${photo ? "#3b3b3b" : "#fff"}">
<svg width="0" height="0"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0"/></filter></svg>
<div style="${photo ? "width:760px;margin:60px auto;transform:rotate(1.4deg);box-shadow:0 8px 30px #0008;filter:blur(0.35px) contrast(0.93);" : "width:700px;margin:40px auto;"}background:#fdfdfb;padding:48px;font:15px/1.5 Georgia,serif;white-space:pre-wrap;position:relative">${esc(text)}${photo ? '<svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"><rect width="100%" height="100%" filter="url(#n)"/></svg>' : ""}</div></body></html>`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 } });
  for (const s of LETTERS) {
    const text = letterText(s);
    const p = await ctx.newPage();
    await p.setContent(page(text, false));
    await p.pdf({ path: `${OUT}/${s.id}.pdf`, format: "Letter", printBackground: true });
    if (s.photo) {
      await p.setContent(page(text, true));
      await p.screenshot({ path: `${OUT}/${s.id}.png` });
      writeFileSync(`${OUT}/${s.id}.ocr.txt`, text);
    }
    writeFileSync(`${OUT}/${s.id}.truth.json`, JSON.stringify(truth(s), null, 2) + "\n");
    await p.close();
  }
  await browser.close();
  console.log(`Wrote ${LETTERS.length} letters to ${OUT}`);
}
main();
