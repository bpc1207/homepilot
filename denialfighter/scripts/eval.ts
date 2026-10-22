/** Runs extraction + classification over fixtures/letters and writes ACCURACY_REPORT.md. `npm run eval` */
import { writeFileSync } from "node:fs";
import { env } from "../src/lib/env";
import { runCorpus, summarize } from "../src/lib/evalCorpus";
import { DENIAL_TYPES } from "../src/lib/schemas";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

async function main() {
  const e = env();
  const results = await runCorpus();
  const s = summarize(results);
  const live = e.LLM_DRIVER !== "mock";
  const L: string[] = [
    "# Accuracy report", "",
    live
      ? `Engine: **${e.LLM_DRIVER}** model \`${e.LLM_MODEL}\`, OCR driver \`${e.OCR_DRIVER}\`.`
      : "> **Engine: deterministic rule-based baseline (mock driver). These numbers are NOT model accuracy.** They show how well simple rules read these synthetic letters, and guard the pipeline against regressions. Run `LLM_DRIVER=bedrock LLM_MODEL=... npm run eval` for real-model numbers.",
    "", "Corpus: 10 fabricated letters (PDF text layer) plus photo-style PNG variants of 3. Photo variants use *simulated* OCR text unless `OCR_DRIVER=textract`, so image quality is not truly tested. All letters follow a limited set of layouts that the same author wrote; real-world letters are messier.", "",
    `Runs: ${s.total}, pipeline errors: ${s.errors}`, "",
    "## Classification", "",
    `- Primary denial type exact match: **${pct(s.primary)}**`, `- Secondary reasons exact match: ${pct(s.secondary)}`, `- Unsupported-plan flag correct: ${pct(s.unsupported)}`, "",
    "## Field extraction (exact match, null must match null)", "", "| Field | Accuracy |", "|---|---|",
    ...Object.entries(s.perField).map(([k, v]) => `| ${k} | ${pct(v)} |`), `| **all fields** | **${pct(s.overallFields)}** |`, "",
    "## Per letter", "", "| Letter | Variant | Expected | Predicted | Wrong fields |", "|---|---|---|---|---|",
    ...results.map((r) => `| ${r.file} | ${r.variant} | ${r.expected} | ${r.error ? `ERROR ${r.error}` : r.predicted} | ${Object.entries(r.fields).filter(([, ok]) => !ok).map(([k]) => k).join(", ") || "none"} |`),
    "", "## Confusion (expected → predicted)", "",
  ];
  const conf: Record<string, Record<string, number>> = {};
  for (const r of results) if (r.predicted) (conf[r.expected] ??= {})[r.predicted] = (conf[r.expected]?.[r.predicted] ?? 0) + 1;
  for (const t of DENIAL_TYPES) if (conf[t]) L.push(`- ${t}: ${Object.entries(conf[t]).map(([p, n]) => `${p}×${n}`).join(", ")}`);
  writeFileSync("ACCURACY_REPORT.md", L.join("\n") + "\n");
  console.log(L.slice(0, 22).join("\n"));
}
main();
