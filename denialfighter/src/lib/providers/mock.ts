import { env } from "../env";
import { classifyRules, extractRules } from "../rules";
import type { LlmProvider, LlmRequest, OcrProvider } from "./types";

/** Mock OCR cannot read pixels. Tests inject text via MockOcr.fixture; otherwise it reports zero confidence. */
export class MockOcr implements OcrProvider {
  static fixture: ((file: Buffer) => string | undefined) | undefined;
  async extractText(file: Buffer) {
    const text = MockOcr.fixture?.(file);
    return text ? { text, confidence: 0.9, pages: 1, method: "mock-ocr" } : { text: "", confidence: 0, pages: 0, method: "mock-ocr" };
  }
}

/** Mock LLM: answers extract/classify with the deterministic rule baseline (see rules.ts). */
export class MockLlm implements LlmProvider {
  async complete(req: LlmRequest) {
    const letter = req.user.match(/<letter>\n([\s\S]*?)\n<\/letter>/)?.[1] ?? "";
    let body: unknown;
    if (req.task === "extract") body = extractRules(letter);
    else if (req.task === "classify") body = classifyRules(letter);
    else body = { text: "", legibility: 0 };
    return { text: JSON.stringify(body), tokensIn: 0, tokensOut: 0, model: env().LLM_MODEL };
  }
}
