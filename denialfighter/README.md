# DenialFighter (MVP, working name)

Helps patients appeal denied health insurance claims: upload a denial letter, confirm the facts, get a tailored appeal
letter, document checklist and deadline reminders. **The user files the appeal; the app never submits anything.**
Not legal or medical advice.

Status: **Phase 2 of 6 (intake pipeline + Denial Checker)**. See the approved architecture and data model in the session plan; summary below.

## Run locally (one command)

```bash
docker compose up --build
```

- App: http://localhost:3000 · magic-link inbox (Mailpit): http://localhost:8025 · MinIO: http://localhost:9001
- Seeded synthetic users: `demo@example.test`, `admin@example.test` (sign in via the Mailpit link)
- Dev defaults use mock OCR/LLM, a local master key and no real PHI. **Use synthetic data only.**

Without Docker: `cp .env.example .env`, run Postgres, then `npx prisma migrate deploy && npm run dev` (set `MAIL_DRIVER=console` to print links in the server log).

## Checks

```bash
npm run typecheck && npm run lint
npm test                       # needs Postgres; uses DB denialfighter_test (TEST_DATABASE_URL to override)
CHROMIUM_PATH=... ./scripts/e2e.sh   # Playwright smoke: sign in, case, upload, audit, delete
```

## What exists in Phase 2

| Area | Implementation |
|---|---|
| Synthetic corpus | `fixtures/letters/`: 10 fabricated denial letters (one per denial type plus multi-reason, no-deadline, Medicare Advantage), PDFs with a text layer, 3 phone-photo-style PNGs, ground-truth JSON. Regenerate with `npm run fixtures` |
| Reading letters | PDF text layer first; images go to Textract (`OCR_DRIVER=textract`); poor OCR or scans fall back to LLM vision |
| Extraction + classification | LLM (`LLM_DRIVER=bedrock`, model from `LLM_MODEL`) returns JSON validated by Zod. Letter text is treated as untrusted data. Codes and quotes not literally in the letter are dropped. Missing facts stay `null` (no invented deadlines) |
| Mock driver | `LLM_DRIVER=mock` uses a deterministic rule-based baseline (`src/lib/rules.ts`) so dev/CI work offline. It is not a model |
| Jobs | `intake` and `checker` queues on pg-boss; `JOBS_DRIVER=inline` runs them in-process for local/e2e |
| Case UI | Processing state, confirm/edit form (your edits win), unsupported-plan notice, manual entry if reading fails |
| Denial Checker | Anonymous upload on the landing page, 24 h encrypted lead, per-IP limit (5/hour), headline + signal before email, details after email + consent, sign-in link converts it to a case (email must match) |
| Funnel events | `checker_uploaded`, `email_captured`, `account_created`, `case_created` in `AnalyticsEvent` (no PHI) |
| Accuracy | `npm run eval` writes `ACCURACY_REPORT.md` (see its banner: mock numbers are a baseline, not model accuracy) |

## What exists in Phase 1

| Area | Implementation |
|---|---|
| Auth | Email magic link; only a SHA-256 of the token is stored; single use (atomic), 15 min TTL; 5 links/hour/email; same response for valid/invalid emails; consent recorded |
| Encryption | Per-case AES-256-GCM data key wrapped by KMS (`KEY_DRIVER=kms`) or a dev master key; uploads encrypted before storage (S3 SSE-KMS is a second layer); ciphertext bound to case id via AAD |
| Delete my case | Crypto-shreds the key first, deletes stored objects, deletes rows, writes an audit entry |
| Audit log | Every case/document read/write goes through `src/lib/phi.ts` and writes an `AuditLog` row (IDs + keyed IP hash only). DB trigger blocks UPDATE/DELETE |
| Logging | Allowlist logger: unknown keys dropped, error messages never logged, Prisma query logging off |
| Uploads | Magic-byte type check (PDF/PNG/JPEG), 15 MB cap, owner-only download |
| Guardrails | `NODE_ENV=production` refuses local keys / console mail / fs storage unless `ALLOW_INSECURE_DEV=true` **and** `APP_URL` is localhost |
| Worker | pg-boss (Postgres-backed) worker boots; schedules expired-lead purge. OCR/extract/etc. queues arrive in Phase 2 |
| Schema | Full approved data model migrated (cases, extraction, appeals, reminders, payments, outcomes, analytics) |

## PHI vendors (BAAs needed before launch)

AWS only (one BAA): ECS Fargate, ALB, CloudFront/WAF, RDS, S3, KMS, Secrets Manager, CloudWatch, SES, Textract, Bedrock.
Anthropic direct API only if used instead of Bedrock (separate BAA + zero retention). Stripe, GitHub, DNS and analytics receive **no PHI**.

## Assumptions and open legal questions

See plan sections 5 and 6: HIPAA status of a consumer tool, unauthorized-practice-of-law / public-adjuster rules for
letter drafting, legality of a success fee (ships OFF), de-identification method and consent for the outcomes dataset,
retention vs deletion, and attorney sign-off on any citation allowlist. Nothing in code asserts legal authority yet.

## Known limits (Phases 1 and 2)

- **Bedrock and Textract adapters have never run**: no AWS credentials in the build environment. They are written to the SDK types but untested; run `LLM_DRIVER=bedrock LLM_MODEL=<id> OCR_DRIVER=textract npm run eval` with credentials and review the report before trusting them.
- Photo-variant tests use simulated OCR text; real photo OCR quality is unmeasured.
- The corpus was written by one author in a few layouts; real insurer letters are far more varied. Treat 100% on it as a smoke test.
- No malware scan on uploads yet; the Checker's email gate is a marketing gate, not a security control (the result is protected by an unguessable id bound to a cookie).

- Docker Compose files are written but **were not run** in the build environment (no Docker daemon). Everything else was verified against a local Postgres.
- Malware scanning of uploads, rate limiting of anonymous endpoints, and the Terraform/AWS deployment arrive in later phases.
- Terms/Privacy text is a placeholder (`CONSENT_VERSION=2026-10-draft`); counsel must supply the real documents.
