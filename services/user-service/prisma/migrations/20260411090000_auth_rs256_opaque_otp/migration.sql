-- This migration is written to be safe with existing data.
-- In particular, it backfills refresh_tokens.tokenId for existing rows.

-- Add 2FA flag on users
ALTER TABLE "users" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Extend refresh_tokens for opaque refresh tokens
ALTER TABLE "refresh_tokens" ADD COLUMN "tokenId" TEXT;
UPDATE "refresh_tokens" SET "tokenId" = "id" WHERE "tokenId" IS NULL;
ALTER TABLE "refresh_tokens" ALTER COLUMN "tokenId" SET NOT NULL;

CREATE UNIQUE INDEX "refresh_tokens_tokenId_key" ON "refresh_tokens"("tokenId");

ALTER TABLE "refresh_tokens" ADD COLUMN "replacedByTokenId" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- Email OTPs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailOtpPurpose') THEN
    CREATE TYPE "EmailOtpPurpose" AS ENUM ('LOGIN_2FA');
  END IF;
END $$;

CREATE TABLE "email_otps" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" "EmailOtpPurpose" NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "requestedIp" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_otps_userId_purpose_idx" ON "email_otps"("userId", "purpose");
CREATE INDEX "email_otps_expiresAt_idx" ON "email_otps"("expiresAt");

ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
