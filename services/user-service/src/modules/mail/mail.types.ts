export type MailJob =
  | {
      type: 'forgot-password';
      to: string;
      displayName?: string | null;
      resetUrl: string;
      expiresAtIso: string;
    }
  | {
      type: 'password-reset-success';
      to: string;
      displayName?: string | null;
    }
  | {
      type: 'otp';
      to: string;
      displayName?: string | null;
      code: string;
      expiresInSeconds: number;
    };
