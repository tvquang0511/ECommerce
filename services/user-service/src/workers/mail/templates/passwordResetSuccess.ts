import type { MailJob } from "../../../modules/mail/mail.types.js";
import { escapeHtml } from "./escape.js";
import { renderLayout } from "./layout.js";

export function buildPasswordResetSuccessMail(
  job: Extract<MailJob, { type: "password-reset-success" }>,
) {
  const appName = "Ecommerce";
  const displayName = job.displayName ? ` ${job.displayName}` : "";
  const subject = `[${appName}] Your password was changed`;

  const text =
    `Hi${displayName},\n\n` +
    `Your password was successfully changed.\n` +
    `If this wasn't you, please contact support immediately.\n`;

  const bodyHtml = `
    <p style="margin:0 0 10px 0; color:#111827;">Hi${job.displayName ? ` <strong>${escapeHtml(job.displayName)}</strong>` : ""},</p>
    <p style="margin:0 0 12px 0; color:#111827; line-height:1.6;">
      Your password was successfully changed.
    </p>
    <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px; color:#374151; line-height:1.6;">
      If this wasn't you, please contact support immediately.
    </div>
  `.trim();

  const html = renderLayout({
    appName,
    title: "Password changed",
    preheader: "Your password was successfully changed.",
    bodyHtml,
  });

  return { subject, text, html };
}
