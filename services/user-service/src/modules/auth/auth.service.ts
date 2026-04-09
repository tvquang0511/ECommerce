import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt, { type Secret } from 'jsonwebtoken';
import { env } from '../../env.js';
import { ApiError } from '@repo/common/errors';
import { authRepo } from './auth.repo.js';

type JwtAccessPayload = {
  sub: string;
  email: string;
};

type JwtRefreshPayload = {
  sub: string;
  type: 'refresh';
};

function signAccessToken(user: { id: string; email: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email } satisfies JwtAccessPayload,
    env.JWT_ACCESS_SECRET as Secret,
    { expiresIn: env.JWT_ACCESS_TTL as any },
  );
}

function signRefreshToken(user: { id: string }) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' } satisfies JwtRefreshPayload,
    env.JWT_REFRESH_SECRET as Secret,
    { expiresIn: env.JWT_REFRESH_TTL as any },
  );
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function makeResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function parseJwtExpiresAt(token: string): Date {
  const decoded = jwt.decode(token) as null | { exp?: number };
  if (!decoded?.exp) {
    throw new ApiError(500, 'AUTH_TOKEN_INVALID', 'Invalid token payload');
  }
  return new Date(decoded.exp * 1000);
}

function publicUser(user: { id: string; email: string; displayName: string; avatarUrl?: string | null }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export const authService = {
  async register(input: { email: string; password: string; displayName: string }) {
    const email = input.email.toLowerCase();
    const existing = await authRepo.findUserByEmail(email);
    if (existing) {
      throw new ApiError(409, 'AUTH_EMAIL_EXISTS', 'Email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const user = await authRepo.createUser({
      email,
      passwordHash,
      displayName: input.displayName,
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const tokenHash = hashToken(refreshToken);
    const expiresAt = parseJwtExpiresAt(refreshToken);
    await authRepo.createRefreshToken({ userId: user.id, tokenHash, expiresAt });

    return { accessToken, refreshToken, user: publicUser(user) };
  },

  async login(input: { email: string; password: string }) {
    const email = input.email.toLowerCase();
    const user = await authRepo.findUserByEmail(email);
    if (!user) {
      throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials');
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new ApiError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials');
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const tokenHash = hashToken(refreshToken);
    const expiresAt = parseJwtExpiresAt(refreshToken);
    await authRepo.createRefreshToken({ userId: user.id, tokenHash, expiresAt });

    return { accessToken, refreshToken, user: publicUser(user) };
  },

  async refresh(input: { refreshToken: string }) {
    let payload: JwtRefreshPayload;
    try {
      payload = jwt.verify(input.refreshToken, env.JWT_REFRESH_SECRET as Secret) as JwtRefreshPayload;
    } catch (e: any) {
      if (e?.name === 'TokenExpiredError') {
        throw new ApiError(401, 'AUTH_TOKEN_EXPIRED', 'Refresh token expired');
      }
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'Refresh token invalid');
    }

    if (payload.type !== 'refresh') {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'Refresh token invalid');
    }

    const tokenHash = hashToken(input.refreshToken);
    const existing = await authRepo.findValidRefreshToken(tokenHash);
    if (!existing) {
      throw new ApiError(401, 'AUTH_REFRESH_REVOKED', 'Refresh token revoked');
    }

    const user = await authRepo.findUserById(payload.sub);
    if (!user) {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'User no longer exists');
    }

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    const newHash = hashToken(newRefreshToken);
    const newExpiresAt = parseJwtExpiresAt(newRefreshToken);

    await authRepo.revokeRefreshToken(existing.id);
    await authRepo.createRefreshToken({ userId: user.id, tokenHash: newHash, expiresAt: newExpiresAt });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(input: { refreshToken: string }) {
    const tokenHash = hashToken(input.refreshToken);
    const existing = await authRepo.findValidRefreshToken(tokenHash);
    if (existing) {
      await authRepo.revokeRefreshToken(existing.id);
    }
    return { ok: true };
  },

  async me(userId: string) {
    const user = await authRepo.findUserById(userId);
    if (!user) {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'User no longer exists');
    }
    return { user: publicUser(user) };
  },

  async forgotPassword(input: { email: string; requestedIp?: string | null; userAgent?: string | null }) {
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
    const resetUrl = `${env.APP_WEB_URL.replace(/\/$/, '')}/reset-password#token=${encodeURIComponent(token)}`;

    // Dev-only helper for Postman testing.
    if (env.NODE_ENV !== 'production') {
      return { ok: true, resetUrl, devResetToken: token, expiresAt: expiresAt.toISOString() };
    }

    return { ok: true };
  },

  async resetPassword(input: { token: string; newPassword: string }) {
    const tokenHash = hashToken(input.token);
    const prt = await authRepo.findValidPasswordResetToken(tokenHash);
    if (!prt) {
      throw new ApiError(400, 'AUTH_RESET_TOKEN_INVALID', 'Reset token invalid or expired');
    }

    const newHash = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);
    await authRepo.updateUserPasswordHash(prt.userId, newHash);
    await authRepo.markPasswordResetTokenUsed(prt.id);
    await authRepo.revokeAllRefreshTokensForUser(prt.userId);
    return { ok: true };
  },
};
