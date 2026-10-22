import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

/** Wraps/unwraps per-case data keys. KMS in production, a local master key in dev/test. */
export interface KeyService {
  wrap(dek: Buffer): Promise<string>;
  unwrap(wrapped: string): Promise<Buffer>;
}

class LocalKeyService implements KeyService {
  private key(): Buffer {
    const b64 = env().APP_MASTER_KEY;
    if (!b64) throw new Error("APP_MASTER_KEY is required when KEY_DRIVER=local");
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32) throw new Error("APP_MASTER_KEY must be 32 bytes, base64-encoded");
    return key;
  }
  async wrap(dek: Buffer) {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this.key(), iv);
    const ct = Buffer.concat([c.update(dek), c.final()]);
    return ["l1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
  }
  async unwrap(wrapped: string) {
    const [v, iv, tag, ct] = wrapped.split(".");
    if (v !== "l1" || !iv || !tag || !ct) throw new Error("Bad wrapped key");
    const d = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]);
  }
}

class KmsKeyService implements KeyService {
  private async client() {
    const { KMSClient } = await import("@aws-sdk/client-kms");
    return new KMSClient({ region: env().S3_REGION });
  }
  private keyId() {
    const id = env().KMS_KEY_ID;
    if (!id) throw new Error("KMS_KEY_ID is required when KEY_DRIVER=kms");
    return id;
  }
  async wrap(dek: Buffer) {
    const { EncryptCommand } = await import("@aws-sdk/client-kms");
    const res = await (await this.client()).send(new EncryptCommand({ KeyId: this.keyId(), Plaintext: dek }));
    return "k1." + Buffer.from(res.CiphertextBlob!).toString("base64");
  }
  async unwrap(wrapped: string) {
    const { DecryptCommand } = await import("@aws-sdk/client-kms");
    const [v, blob] = wrapped.split(".");
    if (v !== "k1" || !blob) throw new Error("Bad wrapped key");
    const res = await (await this.client()).send(
      new DecryptCommand({ KeyId: this.keyId(), CiphertextBlob: Buffer.from(blob, "base64") }),
    );
    return Buffer.from(res.Plaintext!);
  }
}

export function keyService(): KeyService {
  return env().KEY_DRIVER === "kms" ? new KmsKeyService() : new LocalKeyService();
}
