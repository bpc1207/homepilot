import type { Classification, DenialTypeName, ExtractionFields, PlanTypeName } from "./schemas";
import { emptyFields } from "./schemas";

/**
 * Deterministic baseline extractor/classifier. It powers the MOCK LLM driver (offline dev, CI) and is the floor the
 * real model is compared against in the accuracy report. It is NOT a model and handles only common letter layouts.
 */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const pad = (n: number) => String(n).padStart(2, "0");

export function parseDate(s: string): string | null {
  const m1 = s.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (m1) return `${m1[3]}-${pad(MONTHS.indexOf(m1[1].toLowerCase()) + 1)}-${pad(+m1[2])}`;
  const m2 = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m2) return `${m2[3]}-${pad(+m2[1])}-${pad(+m2[2])}`;
  const m3 = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return m3 ? m3[0] : null;
}

function labeled(text: string, labels: string[]): string | null {
  for (const l of labels) {
    const m = text.match(new RegExp(`^\\s*${l}\\s*[:#]\\s*(.+)$`, "im"));
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

function codesOnLines(text: string, lineFilter: RegExp, codeRe: RegExp): string[] {
  const out = new Set<string>();
  for (const line of text.split("\n")) {
    if (!lineFilter.test(line)) continue;
    for (const m of line.matchAll(codeRe)) out.add(m[0].toUpperCase());
  }
  return [...out];
}

function reasonSection(text: string): string | null {
  // Ends at a blank line, the start of the appeal-rights boilerplate, or end of text. PDF text layers drop blank lines.
  const m = text.match(/^\s*(?:reason(?:s)? for denial|denial reason|reason)\s*[:]\s*([\s\S]*?)(?:\n\s*\n|\n\s*(?:you (?:have|may)|if you|sincerely|to appeal)|(?![\s\S]))/im);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

export function extractRules(text: string): ExtractionFields {
  const f = emptyFields();
  const first = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  f.insurer = labeled(text, ["Insurer", "Plan administrator"]) ?? (/(health|insurance|plan|mutual|assurance|care)/i.test(first) && first.length < 80 ? first : null);

  const lower = text.toLowerCase();
  let plan: PlanTypeName = "UNKNOWN";
  if (/medicare advantage/.test(lower)) plan = "MEDICARE_ADVANTAGE";
  else if (/medicaid/.test(lower)) plan = "MEDICAID";
  else if (/marketplace|healthcare\.gov|exchange plan/.test(lower)) plan = "ACA_MARKETPLACE";
  else if (/employer|group health plan|erisa|group number/.test(lower)) plan = "EMPLOYER_GROUP";
  f.planType = plan;

  f.claimRef = labeled(text, ["Claim (?:number|no\\.?|#|id)", "Reference (?:number|no\\.?|#)"]);
  f.service = labeled(text, ["Service(?: description)?", "Procedure", "Service denied"]);
  f.cptCodes = codesOnLines(text, /CPT|HCPCS|procedure code/i, /\b(?:\d{5}|[A-Z]\d{4})\b/g);
  f.icdCodes = codesOnLines(text, /ICD|diagnosis/i, /\b[A-TV-Z]\d{2}(?:\.\d{1,4})?\b/g);
  f.denialReason = reasonSection(text);

  const denialDateLine = labeled(text, ["Date of (?:denial|notice)", "Notice date", "Denial date"]);
  f.denialDate = denialDateLine ? parseDate(denialDateLine) : null;

  const dl = text.match(/(?:appeal[^.\n]*?(?:by|before|on or before|no later than|within [^.\n]*? of)[^.\n]*?|deadline[^.\n]*?[:\s])((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  const dlLine = labeled(text, ["Appeal deadline", "Deadline to appeal", "Appeal by"]);
  f.appealDeadline = dlLine ? parseDate(dlLine) : dl ? parseDate(dl[1]) : null;

  const amt = labeled(text, ["Amount denied", "Denied amount", "Amount not covered"]) ?? text.match(/denied[^$\n]*\$\s?[\d,]+(?:\.\d{2})?/i)?.[0] ?? null;
  const am = amt?.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  f.amountDeniedCents = am ? Math.round(parseFloat(am[1].replace(/,/g, "")) * 100) : null;
  return f;
}

const PATTERNS: [DenialTypeName, RegExp][] = [
  ["PRIOR_AUTH_MISSING", /prior[- ]authori[sz]ation|pre-?certification|pre-?authori[sz]ation|authori[sz]ation (?:was )?(?:not|never) (?:obtained|received|on file)/i],
  ["MEDICAL_NECESSITY", /medically necessary|medical necessity|clinical (?:criteria|guidelines)|not necessary for/i],
  ["OUT_OF_NETWORK", /out[- ]of[- ]network|non-?participating|not (?:a )?(?:contracted|in[- ]network)|not in (?:the|your) network/i],
  ["CODING_ERROR", /coding|modifier|unbundl|duplicate (?:claim|billing)|incorrect(?:ly)? (?:code|billed)|billing error|bundled/i],
  ["EXPERIMENTAL_INVESTIGATIONAL", /experimental|investigational|unproven/i],
  ["TIMELY_FILING", /timely filing|filing (?:limit|deadline)|filed after|received after the|beyond the .{0,40}filing/i],
  ["COVERAGE_EXCLUSION", /exclu(?:ded|sion)|not a covered (?:benefit|service)|not covered under|benefit (?:maximum|limit)|no coverage for/i],
];

export function classifyRules(text: string): Classification {
  const scope = reasonSection(text) ?? text;
  const hits = PATTERNS.map(([type, re]) => ({ type, idx: scope.search(re) }))
    .filter((h) => h.idx >= 0)
    .sort((a, b) => a.idx - b.idx);
  if (hits.length === 0) return { primary: "OTHER", secondary: [], confidence: 0.3, evidence: null };

  const top = hits[0];
  const sentences = scope.split(/(?<=[.!?])\s+/);
  const re = PATTERNS.find(([t]) => t === top.type)![1];
  const evidence = sentences.find((s) => re.test(s))?.slice(0, 500) ?? null;
  return {
    primary: top.type,
    secondary: hits.slice(1).map((h) => h.type),
    confidence: hits.length === 1 ? 0.9 : 0.7,
    evidence,
  };
}
