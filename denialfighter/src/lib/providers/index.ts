import { env } from "../env";
import type { LlmProvider, OcrProvider } from "./types";
import { MockLlm, MockOcr } from "./mock";
import { BedrockLlm } from "./bedrock";
import { TextractOcr } from "./textract";

export * from "./types";
export { MockOcr };

export function ocrProvider(): OcrProvider {
  return env().OCR_DRIVER === "textract" ? new TextractOcr() : new MockOcr();
}

export function llmProvider(): LlmProvider {
  const d = env().LLM_DRIVER;
  if (d === "bedrock") return new BedrockLlm();
  if (d === "anthropic") throw new Error("LLM_DRIVER=anthropic is not implemented; use bedrock or mock");
  return new MockLlm();
}
