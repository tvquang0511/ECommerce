ALTER TABLE "users"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'EmailOtpPurpose'
      AND e.enumlabel = 'EMAIL_VERIFICATION'
  ) THEN
    ALTER TYPE "EmailOtpPurpose" ADD VALUE 'EMAIL_VERIFICATION';
  END IF;
END $$;
