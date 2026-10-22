import { z } from "zod";

export const DENIAL_TYPES = [
  "MEDICAL_NECESSITY", "PRIOR_AUTH_MISSING", "OUT_OF_NETWORK", "CODING_ERROR",
  "EXPERIMENTAL_INVESTIGATIONAL", "COVERAGE_EXCLUSION", "TIMELY_FILING", "OTHER",
] as const;
export type DenialTypeName = (typeof DENIAL_TYPES)[number];

export const PLAN_TYPES = [
  "EMPLOYER_GROUP", "ACA_MARKETPLACE", "INDIVIDUAL_OTHER", "MEDICARE_ADVANTAGE", "MEDICARE", "MEDICAID", "UNKNOWN",
] as const;
export type PlanTypeName = (typeof PLAN_TYPES)[number];

/** Plan types the MVP does not draft appeals for (different forums and timelines). */
export const UNSUPPORTED_PLAN_TYPES: PlanTypeName[] = ["MEDICARE_ADVANTAGE", "MEDICARE", "MEDICAID"];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Facts read from a denial letter. Null means "not stated in the letter" (never guess). */
export const ExtractionSchema = z.object({
  insurer: z.string().max(200).nullable(),
  planType: z.enum(PLAN_TYPES),
  claimRef: z.string().max(100).nullable(),
  service: z.string().max(300).nullable(),
  cptCodes: z.array(z.string().max(10)).max(20),
  icdCodes: z.array(z.string().max(10)).max(20),
  denialReason: z.string().max(1500).nullable(),
  denialDate: isoDate.nullable(),
  appealDeadline: isoDate.nullable(),
  amountDeniedCents: z.number().int().nonnegative().nullable(),
});
export type ExtractionFields = z.infer<typeof ExtractionSchema>;

export const ClassificationSchema = z.object({
  primary: z.enum(DENIAL_TYPES),
  secondary: z.array(z.enum(DENIAL_TYPES)).max(3),
  confidence: z.number().min(0).max(1),
  /** Verbatim span from the letter supporting the primary type. */
  evidence: z.string().max(600).nullable(),
});
export type Classification = z.infer<typeof ClassificationSchema>;

/** What we store (encrypted) in Extraction.fieldsEnc. */
export const StoredAnalysisSchema = z.object({
  fields: ExtractionSchema,
  classification: ClassificationSchema,
  ocr: z.object({ method: z.string(), confidence: z.number() }),
});
export type StoredAnalysis = z.infer<typeof StoredAnalysisSchema>;

export const emptyFields = (): ExtractionFields => ({
  insurer: null, planType: "UNKNOWN", claimRef: null, service: null, cptCodes: [], icdCodes: [],
  denialReason: null, denialDate: null, appealDeadline: null, amountDeniedCents: null,
});
