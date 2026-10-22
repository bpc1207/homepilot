import { describe, expect, it } from "vitest";
import { runCorpus, summarize } from "@/lib/evalCorpus";

// Regression floors for the deterministic baseline against the synthetic corpus. These are NOT model-accuracy claims.
describe("synthetic corpus (rule-based baseline)", () => {
  it("reads every letter without pipeline errors and meets the floors", async () => {
    const results = await runCorpus();
    expect(results.length).toBe(13); // 10 PDFs + 3 photo variants
    expect(results.filter((r) => r.error)).toEqual([]);
    const s = summarize(results);
    expect(s.primary).toBeGreaterThanOrEqual(0.9);
    expect(s.unsupported).toBe(1);
    for (const f of ["cptCodes", "icdCodes", "denialDate", "appealDeadline", "amountDeniedCents"] as const) {
      expect(s.perField[f], f).toBe(1);
    }
    expect(s.overallFields).toBeGreaterThanOrEqual(0.9);
  });

  it("classifies one letter of each denial type correctly", async () => {
    const results = await runCorpus();
    const pdfs = results.filter((r) => r.variant === "pdf");
    const wrong = pdfs.filter((r) => !r.primaryOk).map((r) => `${r.file}: ${r.predicted}`);
    expect(wrong).toEqual([]);
    expect(new Set(pdfs.map((r) => r.expected)).size).toBe(7);
  });

  it("keeps a missing deadline as null instead of inventing one", async () => {
    const r = (await runCorpus()).find((x) => x.file === "09-no-deadline" && x.variant === "pdf")!;
    expect(r.fields.appealDeadline).toBe(true); // truth is null, extractor returned null
  });
});
