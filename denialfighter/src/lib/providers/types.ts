/** Provider interfaces. Implementations (Textract, Bedrock) are selected by env; mocks drive local/CI. */
export type OcrResult = { text: string; confidence: number; pages: number; method: string };

export interface OcrProvider {
  /** Read text from an image (PNG/JPEG). PDFs with a text layer are handled before this is called. */
  extractText(file: Buffer, mime: string): Promise<OcrResult>;
}

export type LlmTask = "extract" | "classify" | "transcribe";

export type LlmRequest = {
  task: LlmTask;
  system: string;
  user: string;
  /** Page images or PDF for vision fallback. */
  files?: { mime: string; data: Buffer }[];
};

export interface LlmProvider {
  /** Returns raw model text (JSON). Implementations must NOT log prompts or completions. */
  complete(req: LlmRequest): Promise<{ text: string; tokensIn: number; tokensOut: number; model: string }>;
}
