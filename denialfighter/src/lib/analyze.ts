import { ClassificationSchema, ExtractionSchema, UNSUPPORTED_PLAN_TYPES, type StoredAnalysis } from "./schemas";
import { CLASSIFY_SYSTEM, EXTRACT_SYSTEM, TRANSCRIBE_SYSTEM, wrapLetter } from "./prompts";
import { llmProvider, ocrProvider, type LlmRequest } from "./providers";
import { log } from "./logger";
import { z } from "zod";

export class AnalysisError extends Error {
  constructor(public code: "OCR_FAILED" | "EXTRACT_FAILED" | "CLASSIFY_FAILED") {
    super(code);
    this.name = "AnalysisError";
  }
}

const MIN_TEXT_LAYER_CHARS = 200;
const MIN_OCR_CONFIDENCE = 0.8;

export type Analysis = StoredAnalysis & { text: string; unsupportedReason: string | null };

function parseJson(raw: string): unknown {
  const s = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b < a) throw new Error("no json");
  return JSON.parse(s.slice(a, b + 1));
}

/** Call the LLM, validate against `schema`, retry once on malformed output. Never logs content. */
async function callJson<T>(req: LlmRequest, schema: z.ZodType<T>, fail: AnalysisError["code"]): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now();
    try {
      const res = await llmProvider().complete(req);
      log.info("llm.call", { model: res.model, tokensIn: res.tokensIn, tokensOut: res.tokensOut, durationMs: Date.now() - t0 });
      const parsed = schema.safeParse(parseJson(res.text));
      if (parsed.success) return parsed.data;
    } catch (err) {
      log.warn("llm.call_failed", { code: (err as { name?: string })?.name ?? "Error", durationMs: Date.now() - t0 });
    }
  }
  throw new AnalysisError(fail);
}

async function readText(file: Buffer, mime: string): Promise<{ text: string; method: string; confidence: number }> {
  if (mime === "application/pdf") {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(file));
      const { text } = await extractText(pdf, { mergePages: true });
      if (text.trim().length >= MIN_TEXT_LAYER_CHARS) return { text, method: "pdf-text", confidence: 0.99 };
    } catch {
      /* fall through to vision */
    }
  } else {
    const ocr = await ocrProvider().extractText(file, mime);
    if (ocr.confidence >= MIN_OCR_CONFIDENCE && ocr.text.trim().length >= MIN_TEXT_LAYER_CHARS / 2) {
      return { text: ocr.text, method: ocr.method, confidence: ocr.confidence };
    }
  }
  // Vision fallback: scanned PDFs, photos, or low-confidence OCR.
  const t = await callJson(
    { task: "transcribe", system: TRANSCRIBE_SYSTEM, user: "Transcribe the attached document.", files: [{ mime, data: file }] },
    z.object({ text: z.string(), legibility: z.number().min(0).max(1) }),
    "OCR_FAILED",
  ).catch(() => null);
  if (!t || t.text.trim().length < 50) throw new AnalysisError("OCR_FAILED");
  return { text: t.text, method: "llm-vision", confidence: t.legibility };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export async function analyzeLetter(file: Buffer, mime: string): Promise<Analysis> {
  const read = await readText(file, mime);
  const user = wrapLetter(read.text);

  const fields = await callJson({ task: "extract", system: EXTRACT_SYSTEM, user }, ExtractionSchema, "EXTRACT_FAILED");
  const classification = await callJson({ task: "classify", system: CLASSIFY_SYSTEM, user }, ClassificationSchema, "CLASSIFY_FAILED");

  // Hallucination guards: only keep codes and quotes that literally appear in the letter.
  const haystack = norm(read.text);
  fields.cptCodes = [...new Set(fields.cptCodes.map((c) => c.toUpperCase()))].filter((c) => haystack.includes(c.toLowerCase()));
  fields.icdCodes = [...new Set(fields.icdCodes.map((c) => c.toUpperCase()))].filter((c) => haystack.includes(c.toLowerCase()));
  if (classification.evidence && !haystack.includes(norm(classification.evidence))) classification.evidence = null;

  const unsupportedReason = UNSUPPORTED_PLAN_TYPES.includes(fields.planType)
    ? "This looks like a Medicare or Medicaid plan. Those appeals follow different rules and forums, so DenialFighter can't draft this one yet."
    : null;

  return { fields, classification, ocr: { method: read.method, confidence: read.confidence }, text: read.text, unsupportedReason };
}

/** Plain-language checker verdict. No outcome predictions or legal claims. */
export type CheckerResult = {
  denialType: StoredAnalysis["classification"]["primary"];
  signal: "LIKELY_APPEALABLE" | "WORTH_REVIEWING" | "HARD" | "UNSUPPORTED" | "UNCLEAR";
  headline: string;
  reasonSummary: string | null;
  appealDeadline: string | null;
  insurer: string | null;
  nextStep: string;
};

const HEADLINES: Record<StoredAnalysis["classification"]["primary"], [CheckerResult["signal"], string, string]> = {
  MEDICAL_NECESSITY: ["LIKELY_APPEALABLE", "Denied as not medically necessary", "These are commonly appealed with a letter of medical necessity from your doctor and supporting records."],
  PRIOR_AUTH_MISSING: ["LIKELY_APPEALABLE", "Denied because prior authorization was missing", "Ask your provider whether authorization was requested; a retroactive authorization or an appeal explaining the circumstances may be possible."],
  OUT_OF_NETWORK: ["WORTH_REVIEWING", "Denied as out-of-network", "Check whether network access or emergency rules apply to your situation, and ask your provider for details."],
  CODING_ERROR: ["LIKELY_APPEALABLE", "Denied over a billing or coding issue", "Often fixed by asking your provider to submit a corrected claim, which may not need a formal appeal."],
  EXPERIMENTAL_INVESTIGATIONAL: ["WORTH_REVIEWING", "Denied as experimental or investigational", "Appeals usually rely on clinical evidence and your doctor's support; outcomes vary."],
  COVERAGE_EXCLUSION: ["WORTH_REVIEWING", "Denied as excluded or not covered", "Your plan document decides this. Upload it so the exact wording can be checked rather than guessed."],
  TIMELY_FILING: ["HARD", "Denied for late filing", "Look for proof of when the claim was first submitted; that is usually what an appeal turns on."],
  OTHER: ["UNCLEAR", "We couldn't tell the main reason", "Review the letter with the details below, or continue and describe the reason yourself."],
};

export function checkerFrom(a: Analysis): CheckerResult {
  const [signal, headline, nextStep] = HEADLINES[a.classification.primary];
  return {
    denialType: a.classification.primary,
    signal: a.unsupportedReason ? "UNSUPPORTED" : signal,
    headline: a.unsupportedReason ? "This looks like a Medicare or Medicaid denial" : headline,
    reasonSummary: a.fields.denialReason,
    appealDeadline: a.fields.appealDeadline,
    insurer: a.fields.insurer,
    nextStep: a.unsupportedReason ?? nextStep,
  };
}
