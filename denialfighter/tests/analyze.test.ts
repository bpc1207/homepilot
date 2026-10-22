import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { AnalysisError, analyzeLetter } from "@/lib/analyze";
import * as providers from "@/lib/providers";

const pdf = readFileSync("fixtures/letters/01-medical-necessity.pdf");
const stub = (responses: Record<string, string[]>) => {
  const calls: Record<string, number> = {};
  vi.spyOn(providers, "llmProvider").mockReturnValue({
    async complete(req) {
      const i = (calls[req.task] = (calls[req.task] ?? 0) + 1) - 1;
      const list = responses[req.task] ?? [];
      return { text: list[Math.min(i, list.length - 1)] ?? "{}", tokensIn: 1, tokensOut: 1, model: "stub" };
    },
  });
  return calls;
};

const goodFields = { insurer: "Northwind Health Plan", planType: "EMPLOYER_GROUP", claimRef: "NW-2026-0003417", service: "MRI lumbar spine", cptCodes: ["72148"], icdCodes: ["M54.16"], denialReason: "x", denialDate: "2026-03-03", appealDeadline: "2026-08-30", amountDeniedCents: 184000 };

beforeEach(() => vi.restoreAllMocks());

describe("analyzeLetter safeguards", () => {
  it("drops codes and quotes that do not appear in the letter (hallucination guard)", async () => {
    stub({
      extract: [JSON.stringify({ ...goodFields, cptCodes: ["72148", "99999"], icdCodes: ["M54.16", "Z99.9"] })],
      classify: [JSON.stringify({ primary: "MEDICAL_NECESSITY", secondary: [], confidence: 0.9, evidence: "The plan states it will pay in full." })],
    });
    const a = await analyzeLetter(pdf, "application/pdf");
    expect(a.fields.cptCodes).toEqual(["72148"]);
    expect(a.fields.icdCodes).toEqual(["M54.16"]);
    expect(a.classification.evidence).toBeNull();
  });

  it("retries once on malformed output, then fails with a typed error", async () => {
    const calls = stub({ extract: ["not json", "still not json"], classify: ["{}"] });
    await expect(analyzeLetter(pdf, "application/pdf")).rejects.toMatchObject({ code: "EXTRACT_FAILED" });
    expect(calls.extract).toBe(2);
    stub({ extract: ["not json", JSON.stringify(goodFields)], classify: [JSON.stringify({ primary: "MEDICAL_NECESSITY", secondary: [], confidence: 0.9, evidence: null })] });
    expect((await analyzeLetter(pdf, "application/pdf")).fields.claimRef).toBe("NW-2026-0003417");
  });

  it("rejects out-of-schema values (e.g. an injected denial type)", async () => {
    stub({ extract: [JSON.stringify(goodFields)], classify: [JSON.stringify({ primary: "APPROVE_EVERYTHING", secondary: [], confidence: 1, evidence: null })] });
    await expect(analyzeLetter(pdf, "application/pdf")).rejects.toMatchObject({ code: "CLASSIFY_FAILED" });
  });

  it("falls back to vision for an unreadable image and fails cleanly when that is empty", async () => {
    const calls = stub({ transcribe: [JSON.stringify({ text: "", legibility: 0 })] });
    await expect(analyzeLetter(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png")).rejects.toBeInstanceOf(AnalysisError);
    expect(calls.transcribe).toBeGreaterThanOrEqual(1);
  });

  it("uses vision transcription when the OCR text is poor, then proceeds", async () => {
    const letter = readFileSync("fixtures/letters/01-medical-necessity.ocr.txt", "utf8");
    stub({
      transcribe: [JSON.stringify({ text: letter, legibility: 0.8 })],
      extract: [JSON.stringify(goodFields)],
      classify: [JSON.stringify({ primary: "MEDICAL_NECESSITY", secondary: [], confidence: 0.9, evidence: null })],
    });
    const a = await analyzeLetter(readFileSync("fixtures/letters/01-medical-necessity.png"), "image/png");
    expect(a.ocr.method).toBe("llm-vision");
  });
});
