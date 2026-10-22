/** Provider interfaces. Implementations (Textract, Bedrock, ...) arrive in Phase 2; mocks drive local/CI. */
export type OcrResult = { text: string; confidence: number; pages: number };

export interface OcrProvider {
  extractText(file: Buffer, mime: string): Promise<OcrResult>;
}

export type LlmRequest = {
  system: string;
  user: string;
  /** Optional page images for vision fallback. */
  images?: { mime: string; data: Buffer }[];
  /** JSON schema description of the expected output; callers validate with Zod. */
  jsonSchemaName?: string;
};

export interface LlmProvider {
  /** Returns raw model text. Implementations must NOT log prompts or completions. */
  complete(req: LlmRequest): Promise<{ text: string; tokensIn: number; tokensOut: number; model: string }>;
}
