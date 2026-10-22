/**
 * Allowlist logger. Only the keys below are ever emitted, and only primitive values.
 * Free-text, messages from caught errors, request bodies, prompts and completions are
 * never logged: they may contain PHI.
 */
const ALLOWED_KEYS = new Set([
  "route", "method", "status", "code", "caseId", "userId", "docId", "jobId", "queue",
  "durationMs", "model", "tokensIn", "tokensOut", "requestId", "count", "driver",
]);

type Level = "info" | "warn" | "error";

export function sanitize(fields: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (!ALLOWED_KEYS.has(k)) continue;
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 64);
  }
  return out;
}

function emit(level: Level, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event: event.slice(0, 64), ...sanitize(fields) });
  (level === "error" ? console.error : console.log)(line);
}

/** Reduce an unknown error to a non-sensitive shape (class name + code only, never message). */
export function errorFields(err: unknown): Record<string, string> {
  const e = err as { name?: unknown; code?: unknown };
  return {
    code: typeof e?.code === "string" ? e.code : typeof e?.name === "string" ? e.name : "UnknownError",
  };
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, err?: unknown, fields?: Record<string, unknown>) =>
    emit("error", event, { ...fields, ...(err ? errorFields(err) : {}) }),
};
