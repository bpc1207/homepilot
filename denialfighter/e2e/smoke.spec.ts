import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Synthetic only. Magic link is read from the server's console-mail log (MAIL_DRIVER=console).
const MAIL_LOG = process.env.MAIL_LOG ?? ".data/server.log";
const PDF = Buffer.from("%PDF-1.4\nSYNTHETIC DENIAL LETTER\n%%EOF");

function latestLink(email?: string): string {
  const log = readFileSync(MAIL_LOG, "utf8");
  const blocks = log.split("[mail:console]").filter((b) => !email || b.includes(`to=${email}`));
  const links = blocks.flatMap((b) => [...b.matchAll(/(http:\/\/[^\s]+\/api\/auth\/verify\?token=[\w-]+)/g)].map((m) => m[1]));
  if (!links.length) throw new Error("no magic link in mail log");
  return links[links.length - 1];
}

test("sign in, create case, upload, view audit, delete", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', `e2e-${Date.now()}@example.test`);
  await page.check('input[name="consent"]');
  await page.click("text=Email me a link");
  await expect(page.getByText("sign-in link is on its way")).toBeVisible();

  await page.waitForTimeout(500);
  await page.goto(latestLink());
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Start a new case" }).click();
  await expect(page).toHaveURL(/\/dashboard\/cases\//);

  await page.setInputFiles('input[name="file"]', { name: "denial.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("denial letter (application/pdf")).toBeVisible();

  await page.goto("/dashboard/audit");
  for (const a of ["AUTH_LOGIN", "CASE_CREATE", "DOCUMENT_UPLOAD"]) await expect(page.getByText(a).first()).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("link", { name: /^Case / }).first().click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete this case and all its data" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("No cases yet.")).toBeVisible();
});

test("denial checker: upload, email gate, sign in, confirm extracted facts", async ({ page }) => {
  const email = `checker-${Date.now()}@example.test`;
  await page.goto("/");
  await page.setInputFiles('input[name="file"]', "fixtures/letters/01-medical-necessity.pdf");
  await page.getByRole("button", { name: "Check my letter" }).click();
  await expect(page).toHaveURL(/\/check\//);
  await expect(page.getByRole("heading", { name: "Denied as not medically necessary" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Appeal deadline on the letter")).toHaveCount(0); // gated until email

  await page.fill('input[name="email"]', email);
  await page.check('input[name="consent"]');
  await page.getByRole("button", { name: "Show full result" }).click();
  await expect(page.getByText("Appeal deadline on the letter")).toBeVisible();
  await expect(page.getByText("2026-08-30")).toBeVisible();

  await page.waitForTimeout(500);
  await page.goto(latestLink(email));
  await expect(page).toHaveURL(/\/dashboard\/cases\//);
  await expect(page.locator('input[name="insurer"]')).toHaveValue("Northwind Health Plan");
  await expect(page.locator('input[name="cptCodes"]')).toHaveValue("72148");
  await expect(page.locator('select[name="denialType"]')).toHaveValue("MEDICAL_NECESSITY");

  await page.fill('input[name="claimRef"]', "NW-2026-0003417");
  await page.getByRole("button", { name: "Confirm details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
});
