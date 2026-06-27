export type MailJob =
  | {
      type: "email-verification";
      to: string;
      displayName?: string | null;
      verificationUrl: string;
      expiresAtIso: string;
    }
  | {
      type: "forgot-password";
      to: string;
      displayName?: string | null;
      resetUrl: string;
      expiresAtIso: string;
    }
  | {
      type: "password-reset-success";
      to: string;
      displayName?: string | null;
    }
  | {
      type: "otp";
      to: string;
      displayName?: string | null;
      code: string;
      expiresInSeconds: number;
      purpose?: "login-2fa" | "email-verification";
    };
