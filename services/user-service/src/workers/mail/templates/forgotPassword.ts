import type { MailJob } from "../../../modules/mail/mail.types.js";
import { escapeHtml } from "./escape.js";
import { renderButton, renderLayout } from "./layout.js";

export function buildForgotPasswordMail(
  job: Extract<MailJob, { type: "forgot-password" }>,
) {
  const appName = "Ecommerce";
  const displayName = job.displayName ? ` ${job.displayName}` : "";
  const subject = `[${appName}] Reset your password`;

  const text =
    `Hi${displayName},\n\n` +
    `We received a request to reset your password.\n\n` +
    `Reset link (expires at ${job.expiresAtIso}):\n${job.resetUrl}\n\n` +
    `If you didn't request this, you can ignore this email.\n`;

  const bodyHtml = `
    <p style="margin:0 0 10px 0; color:#111827;">Hi${job.displayName ? ` <strong>${escapeHtml(job.displayName)}</strong>` : ""},</p>
    <p style="margin:0 0 12px 0; color:#111827; line-height:1.6;">
      We received a request to reset your password.
    </p>
    ${renderButton({ url: job.resetUrl, label: "Reset password" })}
    <p style="margin:12px 0 0 0; color:#374151; line-height:1.6;">
      This link expires at <code style="background:#f3f4f6; padding:2px 6px; border-radius:6px;">${escapeHtml(job.expiresAtIso)}</code>.
    </p>
    <p style="margin:12px 0 0 0; color:#6b7280; line-height:1.6;">
      If the button doesn't work, copy and paste this URL into your browser:<br/>
      <a href="${escapeHtml(job.resetUrl)}" style="color:#111827;">${escapeHtml(job.resetUrl)}</a>
    </p>
    <p style="margin:14px 0 0 0; color:#6b7280; line-height:1.6;">
      If you didn't request this, you can safely ignore this email.
    </p>
  `.trim();

  const html = renderLayout({
    appName,
    title: "Reset your password",
    preheader: "Reset your password using the secure link.",
    bodyHtml,
  });

  return { subject, text, html };
}
