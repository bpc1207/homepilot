import { analyzeLetter, AnalysisError, checkerFrom } from "./analyze";
import { readDocumentForWorker, saveAnalysis, setProcessing, WORKER } from "./phi";
import { readLeadFile, saveLeadResult } from "./leads";
import { log } from "./logger";
import type { JobData } from "./jobs";

/** Case intake: read the uploaded denial letter, extract facts, classify, store encrypted. */
export async function runCaseIntake({ caseId, docId }: JobData) {
  if (!caseId || !docId) throw new Error("BAD_JOB");
  try {
    const { bytes, mime } = await readDocumentForWorker(caseId, docId);
    const analysis = await analyzeLetter(bytes, mime);
    await saveAnalysis(WORKER, caseId, docId, analysis);
    log.info("intake.done", { caseId, docId });
  } catch (err) {
    if (err instanceof AnalysisError) {
      await setProcessing(WORKER, caseId, "FAILED");
      log.warn("intake.analysis_failed", { caseId, docId, code: err.code });
      return; // user can enter details manually; no retry of a deterministic failure
    }
    await setProcessing(WORKER, caseId, "FAILED").catch(() => undefined);
    throw err; // transient (storage, DB): let the queue retry
  }
}

/** Anonymous Denial Checker: same pipeline, result stored on the Lead. */
export async function runLeadCheck({ leadId }: JobData) {
  if (!leadId) throw new Error("BAD_JOB");
  try {
    const { bytes, mime } = await readLeadFile(leadId);
    const a = await analyzeLetter(bytes, mime);
    await saveLeadResult(leadId, {
      checker: checkerFrom(a),
      analysis: { fields: a.fields, classification: a.classification, ocr: a.ocr },
      unsupportedReason: a.unsupportedReason,
    });
  } catch (err) {
    if (err instanceof AnalysisError) {
      await saveLeadResult(leadId, null);
      return;
    }
    throw err;
  }
}

export const handlers: Record<string, (d: JobData) => Promise<void>> = {
  intake: runCaseIntake,
  checker: runLeadCheck,
};
