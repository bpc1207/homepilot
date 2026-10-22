import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  /** Dev/test only: base64 32-byte key used when KEY_DRIVER=local. */
  APP_MASTER_KEY: z.string().optional(),
  KEY_DRIVER: z.enum(["local", "kms"]).default("local"),
  KMS_KEY_ID: z.string().optional(),
  STORAGE_DRIVER: z.enum(["s3", "fs"]).default("s3"),
  STORAGE_FS_DIR: z.string().default(".data/storage"),
  S3_BUCKET: z.string().default("denialfighter-dev"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_FORCE_PATH_STYLE: z.string().default("true"),
  MAIL_DRIVER: z.enum(["smtp", "console"]).default("smtp"),
  MAIL_FROM: z.string().default("DenialFighter <no-reply@denialfighter.test>"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  OCR_DRIVER: z.enum(["mock", "textract"]).default("mock"),
  LLM_DRIVER: z.enum(["mock", "bedrock", "anthropic"]).default("mock"),
  LLM_MODEL: z.string().default("mock-model"),
  /** Lets a production build run with local keys/console mail, only against a localhost APP_URL (docker compose, e2e). */
  ALLOW_INSECURE_DEV: z.string().optional(),
  MAX_UPLOAD_BYTES: z.coerce.number().default(15 * 1024 * 1024),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Names only; values may be secrets.
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment: ${keys}`);
  }
  const e = parsed.data;
  const localOnly = e.ALLOW_INSECURE_DEV === "true" && new URL(e.APP_URL).hostname === "localhost";
  if (e.NODE_ENV === "production" && !localOnly) {
    if (e.KEY_DRIVER !== "kms") throw new Error("Production requires KEY_DRIVER=kms");
    if (e.STORAGE_DRIVER !== "s3") throw new Error("Production requires STORAGE_DRIVER=s3");
    if (e.MAIL_DRIVER === "console") throw new Error("MAIL_DRIVER=console is not allowed in production");
  }
  cached = e;
  return e;
}

export function resetEnvCache() {
  cached = undefined;
}
