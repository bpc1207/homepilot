import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import { keyService } from "./keys";
import { env } from "./env";

/** Envelope encryption: a random 32-byte data key per case, wrapped by the KeyService. */
export async function newDataKey(): Promise<{ dek: Buffer; wrapped: string }> {
  const dek = randomBytes(32);
  return { dek, wrapped: await keyService().wrap(dek) };
}

export async function unwrapDataKey(wrapped: string | null | undefined): Promise<Buffer> {
  if (!wrapped) throw new Error("DATA_KEY_DESTROYED");
  return keyService().unwrap(wrapped);
}

/** AES-256-GCM over bytes. `aad` binds ciphertext to its owner (e.g. caseId). */
export function encryptBytes(dek: Buffer, plaintext: Buffer, aad: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", dek, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return Buffer.concat([Buffer.from([1]), iv, c.getAuthTag(), ct]);
}

export function decryptBytes(dek: Buffer, blob: Buffer, aad: string): Buffer {
  if (blob[0] !== 1) throw new Error("Unknown ciphertext version");
  const iv = blob.subarray(1, 13);
  const tag = blob.subarray(13, 29);
  const ct = blob.subarray(29);
  const d = createDecipheriv("aes-256-gcm", dek, iv);
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

export const encryptText = (dek: Buffer, text: string, aad: string) =>
  encryptBytes(dek, Buffer.from(text, "utf8"), aad).toString("base64");
export const decryptText = (dek: Buffer, b64: string, aad: string) =>
  decryptBytes(dek, Buffer.from(b64, "base64"), aad).toString("utf8");

export const sha256Hex = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

/** Random URL-safe token and its storable hash. Only the hash is persisted. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256Hex(token) };
}

function hmacKey(): string {
  return env().APP_MASTER_KEY ?? env().KMS_KEY_ID ?? "dev";
}

/** Keyed hash for IPs and user ids in audit/analytics, so raw values are never stored. */
export const keyedHash = (value: string) => createHmac("sha256", hmacKey()).update(value).digest("hex").slice(0, 32);
