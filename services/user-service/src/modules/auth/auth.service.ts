import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../env.js";
import { ApiError } from "@repo/common/errors";
import { authRepo } from "./auth.repo.js";
import { getAccessJwtKeys } from "./jwtKeys.js";
import { parseDurationToMs } from "../../common/utils/duration.js";
import { mailQueue } from "../mail/mail.queue.js";
import { prisma } from "../../db/prisma.js";
import { auditRepo } from "../audit/audit.repo.js";

type JwtAccessPayload = {
  sub: string;
  email: string;
};

type PublicRole = {
  name: string;
  displayName: string;
  permissions: string[];
};

type PublicSellerProfile = {
  id: string;
  userId: string;
  shopName: string;
  shopDesc: string | null;
  status: string;
  tier: string;
  isKycVerified: boolean;
  totalProducts: number;
  totalOrders: number;
  avgRating: number | null;
};

type OpaqueRefreshTokenRecord = {
  tokenId: string;
  tokenHash: string;
  token: string;
};

type RequestMeta = {
  ip?: string | null;
  userAgent?: string | null;
  existingRefreshToken?: string | null;
};

type UserWithRbac = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  dateOfBirth?: Date | null;
  phoneNumber?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED" | null;
  passwordHash: string;
  twoFactorEnabled?: boolean;
  roles?: Array<{
    role: {
      name: string;
      displayName: string;
      permissions?: Array<{
        permission: {
          name: string;
        };
      }>;
    };
  }>;
  permissions?: Array<{
    permission: {
      name: string;
    };
  }>;
  sellerProfile?: {
    id: string;
    userId: string;
    shopName: string;
    shopDesc: string | null;
    status: string;
    tier: string;
    isKycVerified: boolean;
    totalProducts: number;
    totalOrders: number;
    avgRating: number | null;
  } | null;
};

function signAccessToken(user: { id: string; email: string }) {
  const { privateKeyPem } = getAccessJwtKeys();
  return jwt.sign(
    { sub: user.id, email: user.email } satisfies JwtAccessPayload,
    privateKeyPem,
    { algorithm: "RS256", expiresIn: env.JWT_ACCESS_TTL as any },
  );
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashRefreshSecret(secret: string) {
  return crypto
    .createHash("sha256")
    .update(`${secret}.${env.REFRESH_TOKEN_PEPPER}`)
    .digest("hex");
}

function makeOpaqueRefreshToken(): OpaqueRefreshTokenRecord {
  const tokenId = crypto.randomBytes(16).toString("base64url");
  const secret = crypto.randomBytes(32).toString("base64url");
  const token = `${tokenId}.${secret}`;
  const tokenHash = hashRefreshSecret(secret);
  return { tokenId, tokenHash, token };
}

function parseOpaqueRefreshToken(token: string): {
  tokenId: string;
  secret: string;
} {
  const idx = token.indexOf(".");
  if (idx <= 0 || idx === token.length - 1) {
    throw new ApiError(401, "AUTH_TOKEN_INVALID", "Refresh token invalid");
  }
  const tokenId = token.slice(0, idx);
  const secret = token.slice(idx + 1);
  if (!tokenId || !secret) {
    throw new ApiError(401, "AUTH_TOKEN_INVALID", "Refresh token invalid");
  }
  return { tokenId, secret };
}

function computeRefreshExpiresAt(): Date {
  const ms = parseDurationToMs(env.JWT_REFRESH_TTL);
  return new Date(Date.now() + ms);
}

function makeResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function makeOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOtpCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(`${code}.${env.REFRESH_TOKEN_PEPPER}`)
    .digest("hex");
}

function publicUser(user: UserWithRbac) {
  const roleNames = (user.roles ?? []).map((entry) => entry.role.name);
  const rolePermissions = (user.roles ?? []).flatMap((entry) =>
    (entry.role.permissions ?? []).map((permission) => permission.permission.name),
  );
  const directPermissions = (user.permissions ?? []).map(
    (entry) => entry.permission.name,
  );

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    dateOfBirth: user.dateOfBirth
      ? user.dateOfBirth.toISOString().slice(0, 10)
      : null,
    phoneNumber: user.phoneNumber ?? null,
    gender: user.gender ?? null,
    roles: roleNames,
    permissions: Array.from(new Set([...rolePermissions, ...directPermissions])),
    sellerProfile: user.sellerProfile
      ? {
          id: user.sellerProfile.id,
          userId: user.sellerProfile.userId,
          shopName: user.sellerProfile.shopName,
          shopDesc: user.sellerProfile.shopDesc,
          status: user.sellerProfile.status,
          tier: user.sellerProfile.tier,
          isKycVerified: user.sellerProfile.isKycVerified,
          totalProducts: user.sellerProfile.totalProducts,
          totalOrders: user.sellerProfile.totalOrders,
          avgRating: user.sellerProfile.avgRating ?? null,
        }
      : null,
  };
}

async function revokeAllSessionsForUser(userId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

async function writeAuditSafe(input: Parameters<typeof auditRepo.write>[0]) {
  try {
    await auditRepo.write(input);
  } catch (err) {
    console.error("[audit] failed to write audit log", err);
  }
}

async function tryResolveExistingSessionId(
  userId: string,
  refreshToken: string | undefined,
) {
  if (!refreshToken) return undefined;

  try {
    const { tokenId, secret } = parseOpaqueRefreshToken(refreshToken);
    const existing = await authRepo.findRefreshTokenByTokenId(tokenId);
    if (!existing) return undefined;
    if (existing.userId !== userId) return undefined;
    if (existing.expiresAt.getTime() <= Date.now()) return undefined;
    if (existing.revokedAt) return undefined;
    if (existing.tokenHash !== hashRefreshSecret(secret)) return undefined;

    const session = await authRepo.findAuthSessionById(existing.sessionId);
    if (!session || session.revokedAt) return undefined;

    return { sessionId: existing.sessionId, refreshTokenId: existing.id };
  } catch {
    return undefined;
  }
}

export const authService = {
  async register(
    input: { email: string; password: string; displayName: string },
    meta?: RequestMeta,
  ) {
    const email = input.email.toLowerCase();
    const existing = await authRepo.findUserByEmail(email);
    if (existing) {
      throw new ApiError(409, "AUTH_EMAIL_EXISTS", "Email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const user = await authRepo.createUser({
      email,
      passwordHash,
      displayName: input.displayName,
    });

    const accessToken = signAccessToken(user);

    const nowDate = new Date();
    const session = await authRepo.createAuthSession({
      userId: user.id,
      createdByIp: meta?.ip,
      createdByUserAgent: meta?.userAgent,
      lastUsedAt: nowDate,
      lastUsedIp: meta?.ip,
      lastUsedUserAgent: meta?.userAgent,
    });

    const refresh = makeOpaqueRefreshToken();
    const expiresAt = computeRefreshExpiresAt();
    await authRepo.createRefreshToken({
      userId: user.id,
      sessionId: session.id,
      tokenId: refresh.tokenId,
      tokenHash: refresh.tokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken: refresh.token, user: publicUser(user) };
  },

  async login(input: { email: string; password: string }, meta?: RequestMeta) {
    const email = input.email.toLowerCase();
    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      throw new ApiError(
        401,
        "AUTH_INVALID_CREDENTIALS",
        "Invalid credentials",
      );
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new ApiError(
        401,
        "AUTH_INVALID_CREDENTIALS",
        "Invalid credentials",
      );
    }

    if (user.twoFactorEnabled) {
      const latest = await authRepo.findLatestActiveEmailOtpForUser({
        userId: user.id,
        purpose: "LOGIN_2FA",
      });
      if (latest) {
        const secondsSince = (Date.now() - latest.createdAt.getTime()) / 1000;
        if (secondsSince < 30) {
          throw new ApiError(
            429,
            "AUTH_OTP_TOO_MANY_REQUESTS",
            "Please wait before requesting another code",
            {
              retryAfterSeconds: Math.ceil(30 - secondsSince),
            },
          );
        }
      }

      const code = makeOtpCode();
      const expiresAt = new Date(
        Date.now() + env.TWO_FACTOR_OTP_TTL_SECONDS * 1000,
      );
      const otp = await authRepo.createEmailOtp({
        userId: user.id,
        purpose: "LOGIN_2FA",
        codeHash: hashOtpCode(code),
        expiresAt,
      });

      const enq = await mailQueue.enqueue({
        type: "otp",
        to: user.email,
        displayName: user.displayName,
        code,
        expiresInSeconds: env.TWO_FACTOR_OTP_TTL_SECONDS,
      });

      if (!enq.enqueued && env.NODE_ENV === "production") {
        throw new ApiError(
          503,
          "AUTH_OTP_DELIVERY_UNAVAILABLE",
          "OTP delivery is temporarily unavailable",
        );
      }

      return {
        twoFactorRequired: true as const,
        challengeId: otp.id,
        expiresAt: expiresAt.toISOString(),
        ...(enq.enqueued ? {} : { devOtp: code }),
      };
    }

    const accessToken = signAccessToken(user);

    const nowDate = new Date();
    const existingSession = await tryResolveExistingSessionId(
      user.id,
      meta?.existingRefreshToken ?? undefined,
    );

    const sessionId =
      existingSession?.sessionId ??
      (
        await authRepo.createAuthSession({
          userId: user.id,
          createdByIp: meta?.ip,
          createdByUserAgent: meta?.userAgent,
          lastUsedAt: nowDate,
          lastUsedIp: meta?.ip,
          lastUsedUserAgent: meta?.userAgent,
        })
      ).id;

    const refresh = makeOpaqueRefreshToken();
    const expiresAt = computeRefreshExpiresAt();

    await prisma.$transaction(async (tx) => {
      if (existingSession?.refreshTokenId) {
        await tx.refreshToken.update({
          where: { id: existingSession.refreshTokenId },
          data: {
            revokedAt: nowDate,
            replacedByTokenId: refresh.tokenId,
            lastUsedAt: nowDate,
          },
        });
      }

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          sessionId,
          tokenId: refresh.tokenId,
          tokenHash: refresh.tokenHash,
          expiresAt,
        },
      });

      await tx.authSession.update({
        where: { id: sessionId },
        data: {
          lastUsedAt: nowDate,
          lastUsedIp: meta?.ip ?? null,
          lastUsedUserAgent: meta?.userAgent ?? null,
        },
      });
    });

    return { accessToken, refreshToken: refresh.token, user: publicUser(user) };
  },

  async verifyTwoFactor(
    input: { challengeId: string; code: string },
    meta?: RequestMeta,
  ) {
    const otp = await authRepo.findEmailOtpById(input.challengeId);
    if (!otp || otp.purpose !== "LOGIN_2FA") {
      throw new ApiError(400, "AUTH_OTP_INVALID", "OTP invalid or expired");
    }

    if (otp.consumedAt) {
      throw new ApiError(400, "AUTH_OTP_INVALID", "OTP invalid or expired");
    }

    if (otp.expiresAt.getTime() <= Date.now()) {
      throw new ApiError(400, "AUTH_OTP_INVALID", "OTP invalid or expired");
    }

    if (otp.attempts >= 5) {
      throw new ApiError(400, "AUTH_OTP_INVALID", "OTP invalid or expired");
    }

    const expected = otp.codeHash;
    const got = hashOtpCode(input.code);
    if (expected !== got) {
      await authRepo.incrementEmailOtpAttempts(otp.id);
      throw new ApiError(400, "AUTH_OTP_INVALID", "OTP invalid or expired");
    }

    await authRepo.consumeEmailOtp(otp.id);

    const user = await authRepo.findUserById(otp.userId);
    if (!user) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }

    const accessToken = signAccessToken(user);

    const nowDate = new Date();
    const session = await authRepo.createAuthSession({
      userId: user.id,
      createdByIp: meta?.ip,
      createdByUserAgent: meta?.userAgent,
      lastUsedAt: nowDate,
      lastUsedIp: meta?.ip,
      lastUsedUserAgent: meta?.userAgent,
    });

    const refresh = makeOpaqueRefreshToken();
    const expiresAt = computeRefreshExpiresAt();

    await authRepo.createRefreshToken({
      userId: user.id,
      sessionId: session.id,
      tokenId: refresh.tokenId,
      tokenHash: refresh.tokenHash,
      expiresAt,
    });
    return { accessToken, refreshToken: refresh.token, user: publicUser(user) };
  },

  async refresh(input: { refreshToken: string }, meta?: RequestMeta) {
    const { tokenId, secret } = parseOpaqueRefreshToken(input.refreshToken);
    const existing = await authRepo.findRefreshTokenByTokenId(tokenId);

    if (!existing) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "Refresh token invalid");
    }

    const now = Date.now();
    if (existing.expiresAt.getTime() <= now) {
      throw new ApiError(401, "AUTH_TOKEN_EXPIRED", "Refresh token expired");
    }

    const expectedHash = existing.tokenHash;
    const gotHash = hashRefreshSecret(secret);
    if (expectedHash !== gotHash) {
      await writeAuditSafe({
        eventType: "REFRESH_COMPROMISED",
        actorUserId: existing.userId,
        targetUserId: existing.userId,
        sessionId: existing.sessionId,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { reason: "HASH_MISMATCH", tokenId },
      });
      await revokeAllSessionsForUser(existing.userId);
      throw new ApiError(
        401,
        "AUTH_REFRESH_COMPROMISED",
        "Possible refresh token compromise detected. Please sign in again.",
      );
    }

    if (existing.revokedAt) {
      await writeAuditSafe({
        eventType: "REFRESH_COMPROMISED",
        actorUserId: existing.userId,
        targetUserId: existing.userId,
        sessionId: existing.sessionId,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { reason: "REUSE_REVOKED_TOKEN", tokenId },
      });
      await revokeAllSessionsForUser(existing.userId);
      throw new ApiError(
        401,
        "AUTH_REFRESH_COMPROMISED",
        "Possible refresh token compromise detected. Please sign in again.",
      );
    }

    const session = await authRepo.findAuthSessionById(existing.sessionId);
    if (!session || session.revokedAt) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "Refresh session revoked");
    }

    const user = await authRepo.findUserById(existing.userId);
    if (!user) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }

    const newAccessToken = signAccessToken(user);
    const refresh = makeOpaqueRefreshToken();
    const newExpiresAt = computeRefreshExpiresAt();

    const nowDate = new Date();
    const rotated = await prisma.$transaction(async (tx) => {
      const revokeRes = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: {
          revokedAt: nowDate,
          replacedByTokenId: refresh.tokenId,
          lastUsedAt: nowDate,
        },
      });

      // If the token was already revoked, this is a reuse attempt (likely leaked).
      if (revokeRes.count !== 1) {
        return false;
      }

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          sessionId: existing.sessionId,
          tokenId: refresh.tokenId,
          tokenHash: refresh.tokenHash,
          expiresAt: newExpiresAt,
        },
      });

      await tx.authSession.update({
        where: { id: existing.sessionId },
        data: {
          lastUsedAt: nowDate,
          lastUsedIp: meta?.ip ?? null,
          lastUsedUserAgent: meta?.userAgent ?? null,
        },
      });

      return true;
    });

    if (!rotated) {
      await writeAuditSafe({
        eventType: "REFRESH_COMPROMISED",
        actorUserId: user.id,
        targetUserId: user.id,
        sessionId: existing.sessionId,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
        metadata: { reason: "REUSE_RACE", tokenId },
      });
      await revokeAllSessionsForUser(user.id);
      throw new ApiError(
        401,
        "AUTH_REFRESH_COMPROMISED",
        "Possible refresh token compromise detected. Please sign in again.",
      );
    }

    return { accessToken: newAccessToken, refreshToken: refresh.token };
  },

  async logout(input: { refreshToken: string }) {
    try {
      const { tokenId, secret } = parseOpaqueRefreshToken(input.refreshToken);
      const existing = await authRepo.findRefreshTokenByTokenId(tokenId);
      if (
        existing &&
        !existing.revokedAt &&
        existing.tokenHash === hashRefreshSecret(secret)
      ) {
        const nowDate = new Date();
        await prisma.$transaction(async (tx) => {
          await tx.refreshToken.updateMany({
            where: { sessionId: existing.sessionId, revokedAt: null },
            data: { revokedAt: nowDate, lastUsedAt: nowDate },
          });
          await tx.authSession.update({
            where: { id: existing.sessionId },
            data: { revokedAt: nowDate, lastUsedAt: nowDate },
          });
        });
      }
    } catch {
      // Ignore invalid refresh token on logout.
    }
    return { ok: true };
  },

  async logoutAll(userId: string) {
    await revokeAllSessionsForUser(userId);
    return { ok: true };
  },

  async listSessions(userId: string) {
    const sessions = await authRepo.listAuthSessionsForUser(userId);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
        revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
        createdByIp: s.createdByIp ?? null,
        createdByUserAgent: s.createdByUserAgent ?? null,
        lastUsedIp: s.lastUsedIp ?? null,
        lastUsedUserAgent: s.lastUsedUserAgent ?? null,
      })),
    };
  },

  async revokeSession(input: { userId: string; sessionId: string }) {
    const session = await authRepo.findAuthSessionById(input.sessionId);
    if (!session || session.userId !== input.userId) {
      throw new ApiError(404, "AUTH_SESSION_NOT_FOUND", "Session not found");
    }

    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { sessionId: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    });

    return { ok: true };
  },

  async me(userId: string) {
    const user = await authRepo.findUserById(userId);
    if (!user) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }
    return { user: publicUser(user) };
  },

  async twoFactorStatus(userId: string) {
    const user = await authRepo.findUserById(userId);
    if (!user) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }
    return { enabled: Boolean(user.twoFactorEnabled) };
  },

  async enableTwoFactor(
    input: { userId: string; password: string },
    meta?: RequestMeta,
  ) {
    const user = await authRepo.findUserById(input.userId);
    if (!user) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new ApiError(
        401,
        "AUTH_INVALID_CREDENTIALS",
        "Invalid credentials",
      );
    }

    if (!user.twoFactorEnabled) {
      await authRepo.setTwoFactorEnabled(user.id, true);
      await writeAuditSafe({
        eventType: "TWO_FACTOR_ENABLED",
        actorUserId: user.id,
        targetUserId: user.id,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      });
    }

    return { enabled: true as const };
  },

  async disableTwoFactor(
    input: { userId: string; password: string },
    meta?: RequestMeta,
  ) {
    const user = await authRepo.findUserById(input.userId);
    if (!user) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new ApiError(
        401,
        "AUTH_INVALID_CREDENTIALS",
        "Invalid credentials",
      );
    }

    if (user.twoFactorEnabled) {
      await authRepo.setTwoFactorEnabled(user.id, false);
      await writeAuditSafe({
        eventType: "TWO_FACTOR_DISABLED",
        actorUserId: user.id,
        targetUserId: user.id,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      });
    }

    return { enabled: false as const };
  },

  async forgotPassword(input: {
    email: string;
    requestedIp?: string | null;
    userAgent?: string | null;
  }) {
    const email = input.email.toLowerCase();
    const user = await authRepo.findUserByEmail(email);

    // Always return ok: don't leak whether email exists.
    if (!user) {
      return { ok: true };
    }

    await authRepo.markAllActivePasswordResetTokensUsed(user.id);

    const token = makeResetToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await authRepo.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
      requestedIp: input.requestedIp ?? null,
      userAgent: input.userAgent ?? null,
    });

    // In a real app, you'd email this URL.
    // Keep it aligned with the Next.js route at /auth/reset-password.
    // Using hash token reduces leakage via referrer/server logs.
    const resetUrl = `${env.APP_WEB_URL.replace(/\/$/, "")}/auth/reset-password#token=${encodeURIComponent(token)}`;

    const enq = await mailQueue.enqueue({
      type: "forgot-password",
      to: user.email,
      displayName: user.displayName,
      resetUrl,
      expiresAtIso: expiresAt.toISOString(),
    });

    if (!enq.enqueued && env.NODE_ENV === "production") {
      // Keep response as ok=true to avoid leaking whether email exists.

      console.error(
        "SMTP/BullMQ not configured; forgot-password email was not enqueued",
      );
    }

    return { ok: true };
  },

  async resetPassword(
    input: { token: string; newPassword: string },
    meta?: RequestMeta,
  ) {
    const tokenHash = hashToken(input.token);
    const prt = await authRepo.findValidPasswordResetToken(tokenHash);
    if (!prt) {
      throw new ApiError(
        400,
        "AUTH_RESET_TOKEN_INVALID",
        "Reset token invalid or expired",
      );
    }

    const newHash = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);
    const user = await authRepo.updateUserPasswordHash(prt.userId, newHash);
    await authRepo.markPasswordResetTokenUsed(prt.id);
    await revokeAllSessionsForUser(prt.userId);

    await mailQueue.enqueue({
      type: "password-reset-success",
      to: user.email,
      displayName: user.displayName,
    });

    await writeAuditSafe({
      eventType: "PASSWORD_RESET_SUCCESS",
      actorUserId: user.id,
      targetUserId: user.id,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
    });

    return { ok: true };
  },

  async changePassword(
    input: { userId: string; currentPassword: string; newPassword: string },
    meta?: RequestMeta,
  ) {
    const user = await authRepo.findUserById(input.userId);
    if (!user) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }

    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw new ApiError(
        401,
        "AUTH_INVALID_CREDENTIALS",
        "Invalid credentials",
      );
    }

    const newHash = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);
    await authRepo.updateUserPasswordHash(user.id, newHash);

    // Security default: revoke all sessions (multi-device) after password change.
    // Note: access tokens are JWTs and can't be force-invalidated without additional checks.
    await revokeAllSessionsForUser(user.id);

    await mailQueue.enqueue({
      type: "password-reset-success",
      to: user.email,
      displayName: user.displayName,
    });

    await writeAuditSafe({
      eventType: "PASSWORD_CHANGED",
      actorUserId: user.id,
      targetUserId: user.id,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
    });

    return { ok: true };
  },
};
