import { env } from "../env";
import type { LlmProvider, LlmRequest } from "./types";

/**
 * AWS Bedrock (Converse API) under the AWS BAA. LLM_MODEL is the Bedrock model/inference-profile id.
 * Invocation logging must stay OFF for the account/region. Prompts and completions are never logged here.
 * NOTE: not exercised in CI (needs AWS credentials); covered by `npm run eval` with LLM_DRIVER=bedrock.
 */
export class BedrockLlm implements LlmProvider {
  async complete(req: LlmRequest) {
    const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
    const client = new BedrockRuntimeClient({ region: env().S3_REGION });
    const content: any[] = [{ text: req.user }];
    for (const f of req.files ?? []) {
      if (f.mime === "application/pdf") content.push({ document: { format: "pdf", name: "letter", source: { bytes: f.data } } });
      else content.push({ image: { format: f.mime === "image/png" ? "png" : "jpeg", source: { bytes: f.data } } });
    }
    const res = await client.send(
      new ConverseCommand({
        modelId: env().LLM_MODEL,
        system: [{ text: req.system }],
        messages: [{ role: "user", content }],
        inferenceConfig: { maxTokens: 2000, temperature: 0 },
      }),
    );
    const text = (res.output?.message?.content ?? []).map((c: any) => c.text ?? "").join("");
    return { text, tokensIn: res.usage?.inputTokens ?? 0, tokensOut: res.usage?.outputTokens ?? 0, model: env().LLM_MODEL };
  }
}
