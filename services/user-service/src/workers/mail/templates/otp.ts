import type { MailJob } from "../../../modules/mail/mail.types.js";
import { escapeHtml } from "./escape.js";
import { renderLayout } from "./layout.js";

export function buildOtpMail(job: Extract<MailJob, { type: "otp" }>) {
  const appName = "Ecommerce";
  const minutes = Math.max(1, Math.round(job.expiresInSeconds / 60));
  const displayName = job.displayName ? ` ${job.displayName}` : "";
  const subject = `[${appName}] Your verification code`;

  const text =
    `Hi${displayName},\n\n` +
    `Your verification code is: ${job.code}\n` +
    `It expires in ${minutes} minute(s).\n\n` +
    `If you didn't request this, you can ignore this email.\n`;

  const bodyHtml = `
    <p style="margin:0 0 10px 0; color:#111827;">Hi${job.displayName ? ` <strong>${escapeHtml(job.displayName)}</strong>` : ""},</p>
    <p style="margin:0 0 12px 0; color:#111827; line-height:1.6;">
      Use this verification code to finish signing in:
    </p>
    <div style="font-size:26px; font-weight:800; letter-spacing:6px; text-align:center; padding:14px 12px; border-radius:12px; border:1px solid #e5e7eb; background:#f9fafb; color:#111827;">
      ${escapeHtml(job.code)}
    </div>
    <p style="margin:12px 0 0 0; color:#374151; line-height:1.6;">
      This code expires in <strong>${minutes}</strong> minute(s).
    </p>
    <p style="margin:12px 0 0 0; color:#6b7280; line-height:1.6;">
      If you didn't request this, you can safely ignore this email.
    </p>
  `.trim();

  const html = renderLayout({
    appName,
    title: "Your verification code",
    preheader: `Your code is ${job.code}. It expires soon.`,
    bodyHtml,
  });

  return { subject, text, html };
}
