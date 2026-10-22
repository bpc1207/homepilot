import { env } from "../env";
import type { LlmProvider, OcrProvider } from "./types";

export * from "./types";

class MockOcr implements OcrProvider {
  async extractText() {
    return { text: "", confidence: 0, pages: 0 };
  }
}
class MockLlm implements LlmProvider {
  async complete() {
    return { text: "{}", tokensIn: 0, tokensOut: 0, model: env().LLM_MODEL };
  }
}

export function ocrProvider(): OcrProvider {
  if (env().OCR_DRIVER !== "mock") throw new Error("OCR driver not implemented until Phase 2");
  return new MockOcr();
}
export function llmProvider(): LlmProvider {
  if (env().LLM_DRIVER !== "mock") throw new Error("LLM driver not implemented until Phase 2");
  return new MockLlm();
}
