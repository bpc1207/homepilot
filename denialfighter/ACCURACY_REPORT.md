# Accuracy report

> **Engine: deterministic rule-based baseline (mock driver). These numbers are NOT model accuracy.** They show how well simple rules read these synthetic letters, and guard the pipeline against regressions. Run `LLM_DRIVER=bedrock LLM_MODEL=... npm run eval` for real-model numbers.

Corpus: 10 fabricated letters (PDF text layer) plus photo-style PNG variants of 3. Photo variants use *simulated* OCR text unless `OCR_DRIVER=textract`, so image quality is not truly tested. All letters follow a limited set of layouts that the same author wrote; real-world letters are messier.

Runs: 13, pipeline errors: 0

## Classification

- Primary denial type exact match: **100%**
- Secondary reasons exact match: 100%
- Unsupported-plan flag correct: 100%

## Field extraction (exact match, null must match null)

| Field | Accuracy |
|---|---|
| insurer | 92% |
| planType | 92% |
| claimRef | 77% |
| service | 77% |
| cptCodes | 100% |
| icdCodes | 100% |
| denialDate | 100% |
| appealDeadline | 100% |
| amountDeniedCents | 100% |
| **all fields** | **93%** |

## Per letter

| Letter | Variant | Expected | Predicted | Wrong fields |
|---|---|---|---|---|
| 01-medical-necessity | pdf | MEDICAL_NECESSITY | MEDICAL_NECESSITY | none |
| 01-medical-necessity | image | MEDICAL_NECESSITY | MEDICAL_NECESSITY | none |
| 02-prior-auth | pdf | PRIOR_AUTH_MISSING | PRIOR_AUTH_MISSING | none |
| 03-out-of-network | pdf | OUT_OF_NETWORK | OUT_OF_NETWORK | none |
| 04-coding-error | pdf | CODING_ERROR | CODING_ERROR | planType |
| 05-experimental | pdf | EXPERIMENTAL_INVESTIGATIONAL | EXPERIMENTAL_INVESTIGATIONAL | claimRef, service |
| 05-experimental | image | EXPERIMENTAL_INVESTIGATIONAL | EXPERIMENTAL_INVESTIGATIONAL | claimRef, service |
| 06-coverage-exclusion | pdf | COVERAGE_EXCLUSION | COVERAGE_EXCLUSION | none |
| 07-timely-filing | pdf | TIMELY_FILING | TIMELY_FILING | claimRef, service |
| 08-multiple-reasons | pdf | PRIOR_AUTH_MISSING | PRIOR_AUTH_MISSING | none |
| 09-no-deadline | pdf | MEDICAL_NECESSITY | MEDICAL_NECESSITY | none |
| 09-no-deadline | image | MEDICAL_NECESSITY | MEDICAL_NECESSITY | none |
| 10-medicare-advantage | pdf | MEDICAL_NECESSITY | MEDICAL_NECESSITY | insurer |

## Confusion (expected → predicted)

- MEDICAL_NECESSITY: MEDICAL_NECESSITY×5
- PRIOR_AUTH_MISSING: PRIOR_AUTH_MISSING×2
- OUT_OF_NETWORK: OUT_OF_NETWORK×1
- CODING_ERROR: CODING_ERROR×1
- EXPERIMENTAL_INVESTIGATIONAL: EXPERIMENTAL_INVESTIGATIONAL×2
- COVERAGE_EXCLUSION: COVERAGE_EXCLUSION×1
- TIMELY_FILING: TIMELY_FILING×1
