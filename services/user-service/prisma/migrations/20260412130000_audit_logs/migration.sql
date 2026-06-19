-- Audit logs for security-relevant events

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,

  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "sessionId" TEXT,

  "ip" TEXT,
  "userAgent" TEXT,

  "metadata" JSONB,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_eventType_idx" ON "audit_logs"("eventType");
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");
CREATE INDEX "audit_logs_targetUserId_idx" ON "audit_logs"("targetUserId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
