import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "./env";

/** Object storage. Callers pass already-encrypted bytes; S3 SSE-KMS is a second layer. */
export interface Storage {
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class FsStorage implements Storage {
  private p(key: string) {
    const root = path.resolve(env().STORAGE_FS_DIR);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Bad storage key");
    return full;
  }
  async put(key: string, body: Buffer) {
    const f = this.p(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, body);
  }
  async get(key: string) {
    return fs.readFile(this.p(key));
  }
  async delete(key: string) {
    await fs.rm(this.p(key), { force: true });
  }
}

class S3Storage implements Storage {
  private async client() {
    const { S3Client } = await import("@aws-sdk/client-s3");
    const e = env();
    return new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: e.S3_FORCE_PATH_STYLE === "true",
      // MinIO locally needs explicit credentials; on AWS the task role is used.
      ...(process.env.S3_ACCESS_KEY_ID
        ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" } }
        : {}),
    });
  }
  async put(key: string, body: Buffer, contentType = "application/octet-stream") {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const e = env();
    await (await this.client()).send(
      new PutObjectCommand({
        Bucket: e.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Local MinIO has no KMS; production bucket default encryption is SSE-KMS.
        ...(e.KEY_DRIVER === "kms" && e.KMS_KEY_ID ? { ServerSideEncryption: "aws:kms" as const, SSEKMSKeyId: e.KMS_KEY_ID } : {}),
      }),
    );
  }
  async get(key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await (await this.client()).send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async delete(key: string) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.client()).send(new DeleteObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
  }
}

export function storage(): Storage {
  return env().STORAGE_DRIVER === "fs" ? new FsStorage() : new S3Storage();
}
