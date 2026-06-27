import { buildEmailVerificationMail } from "./emailVerification.js";
import type { MailJob } from "../../../modules/mail/mail.types.js";
import { buildForgotPasswordMail } from "./forgotPassword.js";
import { buildOtpMail } from "./otp.js";
import { buildPasswordResetSuccessMail } from "./passwordResetSuccess.js";

export function buildMail(job: MailJob): {
  subject: string;
  text: string;
  html: string;
} {
  if (job.type === "email-verification") return buildEmailVerificationMail(job);
  if (job.type === "forgot-password") return buildForgotPasswordMail(job);
  if (job.type === "password-reset-success")
    return buildPasswordResetSuccessMail(job);
  if (job.type === "otp") return buildOtpMail(job);

  // Exhaustive check
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _never: never = job;
  throw new Error("Unknown mail job");
}
