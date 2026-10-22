import { afterEach, describe, expect, it, vi } from "vitest";
import { errorFields, log, sanitize } from "@/lib/logger";

describe("allowlist logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("drops non-allowlisted keys and non-primitive values", () => {
    const out = sanitize({ caseId: "c1", patientName: "Jane Synthetic", body: { a: 1 }, status: 200, nested: ["x"] });
    expect(out).toEqual({ caseId: "c1", status: 200 });
  });

  it("never emits error messages", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    log.error("x", new Error("Claim 123 for Jane Synthetic denied"), { route: "/r" });
    const line = String(spy.mock.calls[0][0]);
    expect(line).not.toContain("Jane");
    expect(line).not.toContain("Claim 123");
    expect(errorFields(new Error("secret"))).toEqual({ code: "Error" });
  });
});
