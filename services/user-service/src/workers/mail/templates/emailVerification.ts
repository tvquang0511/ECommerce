import type { MailJob } from "../../../modules/mail/mail.types.js";
import { escapeHtml } from "./escape.js";
import { renderButton, renderLayout } from "./layout.js";

export function buildEmailVerificationMail(
  job: Extract<MailJob, { type: "email-verification" }>,
) {
  const appName = "Ecommerce";
  const expiresAt = new Date(job.expiresAtIso);
  const text =
    `Hi${job.displayName ? ` ${job.displayName}` : ""},\n\n` +
    `Please verify your email address by opening the link below:\n` +
    `${job.verificationUrl}\n\n` +
    `This link expires at ${expiresAt.toUTCString()}.\n\n` +
    `If you did not create this account, you can safely ignore this email.\n`;

  const bodyHtml = `
    <p style="margin:0 0 10px 0; color:#111827;">Hi${job.displayName ? ` <strong>${escapeHtml(job.displayName)}</strong>` : ""},</p>
    <p style="margin:0 0 12px 0; color:#111827; line-height:1.6;">
      Please confirm your email address to activate your account.
    </p>
    ${renderButton({
      label: "Verify Email",
      url: job.verificationUrl,
    })}
    <p style="margin:12px 0 0 0; color:#374151; line-height:1.6;">
      This link expires at <strong>${escapeHtml(expiresAt.toUTCString())}</strong>.
    </p>
    <p style="margin:12px 0 0 0; color:#6b7280; line-height:1.6; word-break:break-all;">
      If the button does not work, copy and paste this URL into your browser:<br />
      <a href="${escapeHtml(job.verificationUrl)}" style="color:#2563eb;">${escapeHtml(job.verificationUrl)}</a>
    </p>
    <p style="margin:12px 0 0 0; color:#6b7280; line-height:1.6;">
      If you did not create this account, you can safely ignore this email.
    </p>
  `.trim();

  const html = renderLayout({
    appName,
    title: "Verify your email",
    preheader: "Confirm your email address to activate your account.",
    bodyHtml,
  });

  return {
    subject: `[${appName}] Verify your email address`,
    text,
    html,
  };
}
