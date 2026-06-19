import nodemailer from "nodemailer";
import { env } from "../../env.js";

export function createSmtpTransport() {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST and SMTP_FROM (and credentials if needed).",
    );
  }

  const auth = env.SMTP_USER
    ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      }
    : undefined;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth,
  });
}
