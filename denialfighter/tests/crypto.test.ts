import { describe, expect, it } from "vitest";
import { decryptBytes, decryptText, encryptBytes, encryptText, newDataKey, unwrapDataKey } from "@/lib/crypto";

describe("envelope encryption", () => {
  it("round-trips text and bytes", async () => {
    const { dek, wrapped } = await newDataKey();
    expect((await unwrapDataKey(wrapped)).equals(dek)).toBe(true);
    expect(decryptText(dek, encryptText(dek, "Jane Synthetic, CPT 99999", "case1"), "case1")).toBe("Jane Synthetic, CPT 99999");
    const buf = Buffer.from([1, 2, 3, 4]);
    expect(decryptBytes(dek, encryptBytes(dek, buf, "c"), "c").equals(buf)).toBe(true);
  });

  it("uses a fresh IV each time and hides plaintext", async () => {
    const { dek } = await newDataKey();
    const a = encryptText(dek, "same", "c");
    expect(a).not.toBe(encryptText(dek, "same", "c"));
    expect(Buffer.from(a, "base64").toString("latin1")).not.toContain("same");
  });

  it("rejects wrong AAD, wrong key and tampering", async () => {
    const { dek } = await newDataKey();
    const other = (await newDataKey()).dek;
    const ct = encryptBytes(dek, Buffer.from("secret"), "caseA");
    expect(() => decryptBytes(dek, ct, "caseB")).toThrow();
    expect(() => decryptBytes(other, ct, "caseA")).toThrow();
    const bad = Buffer.from(ct);
    bad[bad.length - 1] ^= 0xff;
    expect(() => decryptBytes(dek, bad, "caseA")).toThrow();
  });

  it("refuses to unwrap a destroyed key", async () => {
    await expect(unwrapDataKey(null)).rejects.toThrow("DATA_KEY_DESTROYED");
  });
});

import { env, resetEnvCache } from "@/lib/env";

describe("production guardrails", () => {
  it("refuses local keys / console mail in production unless localhost insecure-dev is set", () => {
    const saved = { ...process.env };
    const set = (o: Record<string, string | undefined>) => { Object.assign(process.env, o); resetEnvCache(); };
    try {
      set({ NODE_ENV: "production" as string, KEY_DRIVER: "local", ALLOW_INSECURE_DEV: undefined, APP_URL: "https://app.example.com" });
      expect(() => env()).toThrow("KEY_DRIVER=kms");
      set({ ALLOW_INSECURE_DEV: "true" }); // not honored for a non-localhost URL
      expect(() => env()).toThrow("KEY_DRIVER=kms");
      set({ APP_URL: "http://localhost:3000" });
      expect(() => env()).not.toThrow();
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
      resetEnvCache();
    }
  });
});
