import { prisma } from "../../db/prisma.js";

const userRbacInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
  permissions: {
    include: {
      permission: true,
    },
  },
  sellerProfile: true,
} as const;

export const authRepo = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: userRbacInclude,
    });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: userRbacInclude,
    });
  },

  createUser(data: {
    email: string;
    passwordHash: string;
    displayName: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data });
      const buyerRole = await tx.role.findUnique({ where: { name: "BUYER" } });

      if (!buyerRole) {
        throw new Error("BUYER role is missing. Run RBAC seed first.");
      }

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: buyerRole.id,
        },
      });

      return user;
    });
  },

  createRefreshToken(data: {
    userId: string;
    sessionId: string;
    tokenId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        tokenId: data.tokenId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  },

  createAuthSession(data: {
    userId: string;
    createdByIp?: string | null;
    createdByUserAgent?: string | null;
    lastUsedAt?: Date | null;
    lastUsedIp?: string | null;
    lastUsedUserAgent?: string | null;
  }) {
    return prisma.authSession.create({
      data: {
        userId: data.userId,
        createdByIp: data.createdByIp ?? null,
        createdByUserAgent: data.createdByUserAgent ?? null,
        lastUsedAt: data.lastUsedAt ?? null,
        lastUsedIp: data.lastUsedIp ?? null,
        lastUsedUserAgent: data.lastUsedUserAgent ?? null,
      },
    });
  },

  findAuthSessionById(id: string) {
    return prisma.authSession.findUnique({ where: { id } });
  },

  listAuthSessionsForUser(userId: string) {
    return prisma.authSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  touchAuthSession(
    id: string,
    data: {
      lastUsedAt?: Date;
      lastUsedIp?: string | null;
      lastUsedUserAgent?: string | null;
    },
  ) {
    return prisma.authSession.update({
      where: { id },
      data: {
        lastUsedAt: data.lastUsedAt,
        lastUsedIp: data.lastUsedIp ?? undefined,
        lastUsedUserAgent: data.lastUsedUserAgent ?? undefined,
      },
    });
  },

  revokeAuthSession(id: string) {
    return prisma.authSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllAuthSessionsForUser(userId: string) {
    return prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  findRefreshTokenByTokenId(tokenId: string) {
    return prisma.refreshToken.findUnique({ where: { tokenId } });
  },

  revokeRefreshToken(
    id: string,
    data?: { replacedByTokenId?: string | null; lastUsedAt?: Date | null },
  ) {
    return prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: data?.replacedByTokenId ?? undefined,
        lastUsedAt: data?.lastUsedAt ?? undefined,
      },
    });
  },

  revokeAllRefreshTokensForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllRefreshTokensForSession(sessionId: string) {
    return prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  createEmailOtp(data: {
    userId: string;
    purpose: "LOGIN_2FA" | "EMAIL_VERIFICATION";
    codeHash: string;
    expiresAt: Date;
    requestedIp?: string | null;
    userAgent?: string | null;
  }) {
    return prisma.emailOtp.create({
      data: {
        userId: data.userId,
        purpose: data.purpose,
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
        requestedIp: data.requestedIp ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  },

  findEmailOtpById(id: string) {
    return prisma.emailOtp.findUnique({ where: { id } });
  },

  findLatestActiveEmailOtpForUser(data: {
    userId: string;
    purpose: "LOGIN_2FA" | "EMAIL_VERIFICATION";
  }) {
    return prisma.emailOtp.findFirst({
      where: {
        userId: data.userId,
        purpose: data.purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  incrementEmailOtpAttempts(id: string) {
    return prisma.emailOtp.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  },

  consumeEmailOtp(id: string) {
    return prisma.emailOtp.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },

  createPasswordResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    requestedIp?: string | null;
    userAgent?: string | null;
  }) {
    return prisma.passwordResetToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        requestedIp: data.requestedIp ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  },

  markAllActivePasswordResetTokensUsed(userId: string) {
    return prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
  },

  findValidPasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  },

  markPasswordResetTokenUsed(id: string) {
    return prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },

  updateUserPasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },

  setTwoFactorEnabled(userId: string, enabled: boolean) {
    return prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: enabled },
    });
  },

  verifyUserEmail(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  },

  createEmailVerificationToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    requestedIp?: string | null;
    userAgent?: string | null;
  }) {
    return prisma.emailVerificationToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        requestedIp: data.requestedIp ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  },

  markAllActiveEmailVerificationTokensUsed(userId: string) {
    return prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
  },

  findValidEmailVerificationToken(tokenHash: string) {
    return prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  },

  markEmailVerificationTokenUsed(id: string) {
    return prisma.emailVerificationToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },

  findLatestActiveEmailVerificationTokenForUser(userId: string) {
    return prisma.emailVerificationToken.findFirst({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
