import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { analyzeLetter } from "./analyze";
import { MockOcr } from "./providers";
import { sha256Hex } from "./crypto";
import { env } from "./env";
import type { DenialTypeName } from "./schemas";

const DIR = "fixtures/letters";
const FIELDS = ["insurer", "planType", "claimRef", "service", "cptCodes", "icdCodes", "denialDate", "appealDeadline", "amountDeniedCents"] as const;
export type FieldName = (typeof FIELDS)[number];

type Truth = { fields: Record<FieldName, unknown>; denialType: DenialTypeName; secondary: DenialTypeName[]; unsupported: boolean };
export type LetterResult = {
  file: string; variant: "pdf" | "image"; error?: string;
  fields: Partial<Record<FieldName, boolean>>;
  primaryOk?: boolean; secondaryOk?: boolean; unsupportedOk?: boolean;
  predicted?: DenialTypeName; expected: DenialTypeName;
};

const norm = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().toLowerCase() : v);
const sameSet = (a: unknown, b: unknown) => JSON.stringify([...(a as string[])].sort()) === JSON.stringify([...(b as string[])].sort());

function fieldMatch(name: FieldName, got: unknown, want: unknown): boolean {
  if (name === "cptCodes" || name === "icdCodes") return sameSet(got, want);
  if (name === "service" && typeof got === "string" && typeof want === "string") {
    const [g, w] = [norm(got) as string, norm(want) as string];
    return g === w || g.includes(w) || w.includes(g);
  }
  return norm(got) === norm(want);
}

export async function runCorpus(): Promise<LetterResult[]> {
  const ids = readdirSync(DIR).filter((f) => f.endsWith(".truth.json")).map((f) => f.replace(".truth.json", "")).sort();
  const ocrBySha = new Map<string, string>();
  for (const id of ids) {
    try { ocrBySha.set(sha256Hex(readFileSync(path.join(DIR, `${id}.png`))), readFileSync(path.join(DIR, `${id}.ocr.txt`), "utf8")); } catch { /* no photo variant */ }
  }
  if (env().OCR_DRIVER === "mock") MockOcr.fixture = (buf) => ocrBySha.get(sha256Hex(buf));

  const out: LetterResult[] = [];
  for (const id of ids) {
    const truth: Truth = JSON.parse(readFileSync(path.join(DIR, `${id}.truth.json`), "utf8"));
    for (const [variant, ext, mime] of [["pdf", "pdf", "application/pdf"], ["image", "png", "image/png"]] as const) {
      let bytes: Buffer;
      try { bytes = readFileSync(path.join(DIR, `${id}.${ext}`)); } catch { continue; }
      const r: LetterResult = { file: id, variant, fields: {}, expected: truth.denialType };
      try {
        const a = await analyzeLetter(bytes, mime);
        for (const f of FIELDS) r.fields[f] = fieldMatch(f, a.fields[f], truth.fields[f]);
        r.predicted = a.classification.primary;
        r.primaryOk = a.classification.primary === truth.denialType;
        r.secondaryOk = sameSet(a.classification.secondary, truth.secondary);
        r.unsupportedOk = (a.unsupportedReason !== null) === truth.unsupported;
      } catch (e) {
        r.error = (e as { code?: string }).code ?? "ERROR";
      }
      out.push(r);
    }
  }
  return out;
}

export function summarize(results: LetterResult[]) {
  const ok = results.filter((r) => !r.error);
  const rate = (n: number, d: number) => (d === 0 ? 0 : n / d);
  const perField = Object.fromEntries(FIELDS.map((f) => [f, rate(ok.filter((r) => r.fields[f]).length, ok.length)])) as Record<FieldName, number>;
  return {
    total: results.length, errors: results.length - ok.length, perField,
    primary: rate(ok.filter((r) => r.primaryOk).length, ok.length),
    secondary: rate(ok.filter((r) => r.secondaryOk).length, ok.length),
    unsupported: rate(ok.filter((r) => r.unsupportedOk).length, ok.length),
    overallFields: rate(ok.reduce((s, r) => s + FIELDS.filter((f) => r.fields[f]).length, 0), ok.length * FIELDS.length),
  };
}
