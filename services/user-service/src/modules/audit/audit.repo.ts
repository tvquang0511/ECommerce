import crypto from 'node:crypto';

import { prisma } from '../../db/prisma.js';

export type AuditEventType =
  | 'TWO_FACTOR_ENABLED'
  | 'TWO_FACTOR_DISABLED'
  | 'REFRESH_COMPROMISED'
  | 'PASSWORD_RESET_SUCCESS';

export type AuditLogInput = {
  eventType: AuditEventType;
  actorUserId?: string | null;
  targetUserId?: string | null;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const auditRepo = {
  async write(input: AuditLogInput) {
    const id = crypto.randomUUID();
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

    await prisma.$executeRaw`
      INSERT INTO "audit_logs" (
        "id",
        "eventType",
        "actorUserId",
        "targetUserId",
        "sessionId",
        "ip",
        "userAgent",
        "metadata",
        "createdAt"
      ) VALUES (
        ${id},
        ${input.eventType},
        ${input.actorUserId ?? null},
        ${input.targetUserId ?? null},
        ${input.sessionId ?? null},
        ${input.ip ?? null},
        ${input.userAgent ?? null},
        ${metadataJson}::jsonb,
        CURRENT_TIMESTAMP
      )
    `;
  },
};
