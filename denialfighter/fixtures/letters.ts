// Synthetic denial letters. Every name, insurer, address and number is fictional; phone numbers use the reserved 555-01xx range.
import type { DenialTypeName, PlanTypeName } from "../src/lib/schemas";

export type LetterSpec = {
  id: string;
  insurer: string;
  address: string;
  patient: string;
  memberId: string;
  planPhrase: string;
  planType: PlanTypeName;
  claimLabel: string;
  claimRef: string;
  service: string;
  cpt: string[];
  icd: string[];
  reason: string;
  denialDate: string; // ISO
  /** Days after denialDate that the letter states as the appeal deadline; null = letter states none. */
  deadlineDays: number | null;
  amountCents: number | null;
  denialType: DenialTypeName;
  secondary: DenialTypeName[];
  style: "labeled" | "narrative";
  photo: boolean;
};

export const LETTERS: LetterSpec[] = [
  { id: "01-medical-necessity", insurer: "Northwind Health Plan", address: "PO Box 5501, Springfield, ST 00001", patient: "Jordan Sample", memberId: "NWH-000-1111-01",
    planPhrase: "Employer group health plan (ERISA)", planType: "EMPLOYER_GROUP", claimLabel: "Claim Number", claimRef: "NW-2026-0003417",
    service: "MRI lumbar spine without contrast", cpt: ["72148"], icd: ["M54.16"],
    reason: "The requested service is not medically necessary. Based on our clinical criteria, at least six weeks of conservative therapy must be documented before advanced imaging of the lumbar spine, and no such documentation was received.",
    denialDate: "2026-03-03", deadlineDays: 180, amountCents: 184000, denialType: "MEDICAL_NECESSITY", secondary: [], style: "labeled", photo: true },
  { id: "02-prior-auth", insurer: "Cedar Valley Insurance Company", address: "200 Example Way, Riverton, ST 00002", patient: "Casey Testperson", memberId: "CVI-555-2222-03",
    planPhrase: "Health Insurance Marketplace plan", planType: "ACA_MARKETPLACE", claimLabel: "Claim No.", claimRef: "CV7788210",
    service: "Arthroscopic knee surgery (meniscectomy)", cpt: ["29881"], icd: ["M23.221"],
    reason: "Prior authorization was not obtained before the procedure was performed, as required by your plan for outpatient surgery.",
    denialDate: "2026-04-14", deadlineDays: 180, amountCents: 1245000, denialType: "PRIOR_AUTH_MISSING", secondary: [], style: "labeled", photo: false },
  { id: "03-out-of-network", insurer: "Summit Mutual Health", address: "1 Sample Plaza, Lakeside, ST 00003", patient: "Riley Fakename", memberId: "SMH-300-4444-02",
    planPhrase: "Employer group health plan", planType: "EMPLOYER_GROUP", claimLabel: "Reference #", claimRef: "SM-90-448812",
    service: "Specialist office visit, established patient", cpt: ["99214"], icd: ["E11.9"],
    reason: "The provider is a non-participating (out-of-network) provider, and your plan does not cover out-of-network services except in an emergency.",
    denialDate: "2026-02-20", deadlineDays: 180, amountCents: 38500, denialType: "OUT_OF_NETWORK", secondary: [], style: "labeled", photo: false },
  { id: "04-coding-error", insurer: "Harborview Assurance", address: "77 Placeholder Ave, Baytown, ST 00004", patient: "Morgan Notreal", memberId: "HVA-900-6666-01",
    planPhrase: "Individual health plan", planType: "INDIVIDUAL_OTHER", claimLabel: "Claim Number", claimRef: "HV-5521-0090",
    service: "Comprehensive metabolic panel", cpt: ["80053", "80048"], icd: ["Z00.00"],
    reason: "The claim was denied due to a billing error: CPT 80053 is bundled with CPT 80048 and cannot be billed on the same date of service without an appropriate modifier.",
    denialDate: "2026-05-09", deadlineDays: 180, amountCents: 21200, denialType: "CODING_ERROR", secondary: [], style: "labeled", photo: false },
  { id: "05-experimental", insurer: "Pinecrest Health Alliance", address: "88 Fictional Rd, Hillview, ST 00005", patient: "Avery Madeup", memberId: "PHA-200-7777-04",
    planPhrase: "Employer group health plan (ERISA)", planType: "EMPLOYER_GROUP", claimLabel: "claim number", claimRef: "PH-31-77120",
    service: "Transcranial magnetic stimulation", cpt: ["90867"], icd: ["F33.2"],
    reason: "We have determined that this treatment is investigational for your diagnosis and is therefore not covered.",
    denialDate: "2026-01-12", deadlineDays: 180, amountCents: 960000, denialType: "EXPERIMENTAL_INVESTIGATIONAL", secondary: [], style: "narrative", photo: true },
  { id: "06-coverage-exclusion", insurer: "Lakeshore Benefits Plan", address: "9 Imaginary St, Portside, ST 00006", patient: "Quinn Example", memberId: "LBP-410-8888-01",
    planPhrase: "Employer group health plan", planType: "EMPLOYER_GROUP", claimLabel: "Claim Number", claimRef: "LB-2026-554",
    service: "Hearing aids, bilateral", cpt: ["V5261"], icd: ["H90.3"],
    reason: "Hearing aids are excluded under your plan. This service is not a covered benefit.",
    denialDate: "2026-06-02", deadlineDays: 180, amountCents: 320000, denialType: "COVERAGE_EXCLUSION", secondary: [], style: "labeled", photo: false },
  { id: "07-timely-filing", insurer: "Bluestone Health Partners", address: "4 Mockingbird Ln, Fairview, ST 00007", patient: "Skyler Imaginary", memberId: "BHP-120-9999-02",
    planPhrase: "Health Insurance Marketplace plan", planType: "ACA_MARKETPLACE", claimLabel: "claim number", claimRef: "BS-8841-2209",
    service: "Office visit, established patient", cpt: ["99213"], icd: ["J06.9"],
    reason: "Your provider's claim was received 412 days after the date of service, after the 365-day timely filing limit, and cannot be processed.",
    denialDate: "2026-03-30", deadlineDays: 180, amountCents: 17500, denialType: "TIMELY_FILING", secondary: [], style: "narrative", photo: false },
  { id: "08-multiple-reasons", insurer: "Redwood Community Health", address: "310 Sample Blvd, Oakdale, ST 00008", patient: "Drew Placeholder", memberId: "RCH-777-1212-01",
    planPhrase: "Employer group health plan", planType: "EMPLOYER_GROUP", claimLabel: "Claim Number", claimRef: "RW-60-31415",
    service: "Physical therapy, therapeutic exercise", cpt: ["97110"], icd: ["M25.511"],
    reason: "1. Prior authorization was not obtained for these visits. 2. The services were not medically necessary beyond the initial 12 visits.",
    denialDate: "2026-04-02", deadlineDays: 180, amountCents: 112000, denialType: "PRIOR_AUTH_MISSING", secondary: ["MEDICAL_NECESSITY"], style: "labeled", photo: false },
  { id: "09-no-deadline", insurer: "Maple Grove Insurance", address: "52 Test Court, Elmwood, ST 00009", patient: "Parker Fictional", memberId: "MGI-050-3434-03",
    planPhrase: "Employer group health plan", planType: "EMPLOYER_GROUP", claimLabel: "Claim Number", claimRef: "MG-2026-90871",
    service: "MRI brain with and without contrast", cpt: ["70553"], icd: ["G43.909"],
    reason: "This service does not meet clinical criteria for medical necessity under your plan's imaging guidelines.",
    denialDate: "2026-07-15", deadlineDays: null, amountCents: 295000, denialType: "MEDICAL_NECESSITY", secondary: [], style: "labeled", photo: true },
  { id: "10-medicare-advantage", insurer: "Golden State Senior Advantage", address: "600 Sample Pkwy, Sunnydale, ST 00010", patient: "Taylor Nobody", memberId: "GSA-808-5656-01",
    planPhrase: "Medicare Advantage (Part C) plan", planType: "MEDICARE_ADVANTAGE", claimLabel: "Claim Number", claimRef: "GS-MA-4410-77",
    service: "Total knee replacement", cpt: ["27447"], icd: ["M17.11"],
    reason: "The requested service is not medically necessary based on the clinical criteria used by the plan.",
    denialDate: "2026-05-20", deadlineDays: 65, amountCents: 3400000, denialType: "MEDICAL_NECESSITY", secondary: [], style: "labeled", photo: false },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};
export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export function truth(s: LetterSpec) {
  return {
    fields: {
      insurer: s.insurer, planType: s.planType, claimRef: s.claimRef, service: s.service, cptCodes: s.cpt, icdCodes: s.icd,
      denialDate: s.denialDate, appealDeadline: s.deadlineDays == null ? null : addDays(s.denialDate, s.deadlineDays), amountDeniedCents: s.amountCents,
    },
    denialType: s.denialType,
    secondary: s.secondary,
    unsupported: ["MEDICARE_ADVANTAGE", "MEDICARE", "MEDICAID"].includes(s.planType),
  };
}

/** Plain text of the letter (also the simulated OCR output for the photo variant). */
export function letterText(s: LetterSpec): string {
  const deadline = s.deadlineDays == null ? null : longDate(addDays(s.denialDate, s.deadlineDays));
  const L: string[] = [s.insurer, s.address, "Member Services: 800-555-0142", "", `Date of Denial: ${longDate(s.denialDate)}`, "", `Dear ${s.patient},`, ""];
  if (s.style === "labeled") {
    L.push("We have reviewed your claim and are unable to approve payment.", "",
      `Member ID: ${s.memberId}`, `Plan: ${s.planPhrase}`, `${s.claimLabel}: ${s.claimRef}`,
      `Service: ${s.service}`, `CPT/HCPCS code(s): ${s.cpt.join(", ")}`, `ICD-10 diagnosis code(s): ${s.icd.join(", ")}`,
      ...(s.amountCents != null ? [`Amount denied: ${money(s.amountCents)}`] : []), "",
      `Reason for denial: ${s.reason}`, "");
  } else {
    L.push(`We reviewed ${s.claimLabel} ${s.claimRef} for ${s.service.toLowerCase()} under your ${s.planPhrase.toLowerCase()} (Member ID ${s.memberId}).`, "",
      `The service was billed with CPT code ${s.cpt.join(", ")} and diagnosis (ICD-10) ${s.icd.join(", ")}.${s.amountCents != null ? ` The amount denied is ${money(s.amountCents)}.` : ""}`, "",
      `Reason for denial: ${s.reason}`, "");
  }
  L.push(
    deadline
      ? `You have the right to appeal this decision. Your appeal must be submitted in writing on or before ${deadline}.`
      : "You have the right to appeal this decision by submitting a written request to the address above.",
    "You may include any additional information, such as medical records or a statement from your doctor.",
    "You may request, free of charge, copies of the documents and criteria used to make this decision.", "",
    "Sincerely,", "Appeals and Grievances Department", s.insurer);
  return L.join("\n");
}
