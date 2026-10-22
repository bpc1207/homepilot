import { env } from "../env";
import type { OcrProvider } from "./types";

/** AWS Textract synchronous text detection for PNG/JPEG (under the AWS BAA). Not exercised in CI. */
export class TextractOcr implements OcrProvider {
  async extractText(file: Buffer) {
    const { TextractClient, DetectDocumentTextCommand } = await import("@aws-sdk/client-textract");
    const res = await new TextractClient({ region: env().S3_REGION }).send(
      new DetectDocumentTextCommand({ Document: { Bytes: file } }),
    );
    const lines = (res.Blocks ?? []).filter((b) => b.BlockType === "LINE");
    const text = lines.map((b) => b.Text ?? "").join("\n");
    const conf = lines.length ? lines.reduce((s, b) => s + (b.Confidence ?? 0), 0) / lines.length / 100 : 0;
    return { text, confidence: conf, pages: 1, method: "textract" };
  }
}
