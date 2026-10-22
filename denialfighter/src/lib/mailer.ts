import nodemailer from "nodemailer";
import { env } from "./env";

export type Mail = { to: string; subject: string; text: string };

/**
 * Transactional email. Bodies must never contain PHI (no insurer, service or amounts):
 * a magic link or a generic "deadline approaching" note only.
 */
export async function sendMail(mail: Mail) {
  const e = env();
  if (e.MAIL_DRIVER === "console") {
    // Dev only (blocked in production by env()). Prints the link so it can be clicked without an inbox.
    console.log(`\n[mail:console] to=${mail.to}\nsubject: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  const t = nodemailer.createTransport({ host: e.SMTP_HOST, port: e.SMTP_PORT, secure: false, ignoreTLS: e.NODE_ENV !== "production" });
  await t.sendMail({ from: e.MAIL_FROM, ...mail });
}
