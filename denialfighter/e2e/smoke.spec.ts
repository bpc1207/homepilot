import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Synthetic only. Magic link is read from the server's console-mail log (MAIL_DRIVER=console).
const MAIL_LOG = process.env.MAIL_LOG ?? ".data/server.log";
const PDF = Buffer.from("%PDF-1.4\nSYNTHETIC DENIAL LETTER\n%%EOF");

function latestLink(): string {
  const m = [...readFileSync(MAIL_LOG, "utf8").matchAll(/(http:\/\/[^\s]+\/api\/auth\/verify\?token=[\w-]+)/g)];
  if (!m.length) throw new Error("no magic link in mail log");
  return m[m.length - 1][1];
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
