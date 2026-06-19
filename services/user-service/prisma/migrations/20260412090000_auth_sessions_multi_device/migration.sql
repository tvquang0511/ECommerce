-- Multi-device auth sessions
-- - Create auth_sessions table
-- - Add sessionId to refresh_tokens
-- - Backfill sessions using existing refresh_tokens.token_id for continuity

-- 1) auth_sessions
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdByIp" TEXT,
  "createdByUserAgent" TEXT,
  "lastUsedIp" TEXT,
  "lastUsedUserAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auth_sessions_userId_idx" ON "auth_sessions"("userId");

ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) refresh_tokens.sessionId (nullable first)
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- 3) Backfill sessions and refresh_tokens.session_id
-- Use token_id as session id for existing rows to keep migration deterministic without requiring uuid extension.
INSERT INTO "auth_sessions" ("id", "userId", "revokedAt", "lastUsedAt", "createdAt", "updatedAt")
SELECT
  MIN(rt."tokenId") AS "id",
  rt."userId" AS "userId",
  NULL AS "revokedAt",
  MAX(rt."lastUsedAt") AS "lastUsedAt",
  MIN(rt."createdAt") AS "createdAt",
  CURRENT_TIMESTAMP AS "updatedAt"
FROM "refresh_tokens" rt
WHERE rt."sessionId" IS NULL
GROUP BY rt."userId"
ON CONFLICT ("id") DO NOTHING;

UPDATE "refresh_tokens" rt
SET "sessionId" = s."id"
FROM "auth_sessions" s
WHERE rt."sessionId" IS NULL
  AND s."userId" = rt."userId";

-- 4) Enforce NOT NULL + FK
ALTER TABLE "refresh_tokens" ALTER COLUMN "sessionId" SET NOT NULL;

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "auth_sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "refresh_tokens_sessionId_idx" ON "refresh_tokens"("sessionId");
