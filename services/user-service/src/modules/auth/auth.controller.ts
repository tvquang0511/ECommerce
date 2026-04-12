import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../env.js';
import { authService } from './auth.service.js';
import { parseDurationToMs } from '../../common/utils/duration.js';
import { ApiError } from '@repo/common/errors';

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).max(100),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
});

const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});

const verifyTwoFactorBodySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().min(6).max(6),
});

const twoFactorToggleBodySchema = z.object({
  password: z.string().min(1),
});

function setRefreshCookie(res: Response, refreshToken: string) {
  const maxAgeMs = parseDurationToMs(env.JWT_REFRESH_TTL);
  res.cookie(env.AUTH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: env.AUTH_COOKIE_SAME_SITE as any,
    path: env.AUTH_COOKIE_PATH,
    maxAge: maxAgeMs,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: env.AUTH_COOKIE_SAME_SITE as any,
    path: env.AUTH_COOKIE_PATH,
  });
}

export const register = async (req: Request, res: Response) => {
  const input = registerBodySchema.parse(req.body);
  const result = await authService.register(input);
  setRefreshCookie(res, result.refreshToken);
  return res.status(201).json({ accessToken: result.accessToken, user: result.user });
};

export const login = async (req: Request, res: Response) => {
  const input = loginBodySchema.parse(req.body);
  const result = await authService.login(input);
  if ('twoFactorRequired' in result) {
    return res.json(result);
  }
  setRefreshCookie(res, result.refreshToken);
  return res.json({ accessToken: result.accessToken, user: result.user });
};

export const verifyTwoFactor = async (req: Request, res: Response) => {
  const input = verifyTwoFactorBodySchema.parse(req.body);
  const result = await authService.verifyTwoFactor(input);
  setRefreshCookie(res, result.refreshToken);
  return res.json({ accessToken: result.accessToken, user: result.user });
};

export const refresh = async (req: Request, res: Response) => {
  const cookieToken = (req.cookies as any)?.[env.AUTH_COOKIE_NAME] as string | undefined;

  const bodyToken = (() => {
    try {
      return refreshBodySchema.parse(req.body).refreshToken;
    } catch {
      return undefined;
    }
  })();

  const refreshToken = cookieToken ?? bodyToken;
  if (!refreshToken) {
    return res.status(401).json({
      error: {
        code: 'AUTH_TOKEN_INVALID',
        message: 'Refresh token missing',
        details: {},
      },
    });
  }

  try {
    const result = await authService.refresh({ refreshToken });
    setRefreshCookie(res, result.refreshToken);
    return res.json({ accessToken: result.accessToken });
  } catch (e: any) {
    if (e instanceof ApiError && e.code === 'AUTH_REFRESH_COMPROMISED') {
      clearRefreshCookie(res);
    }
    throw e;
  }
};

export const logout = async (req: Request, res: Response) => {
  const cookieToken = (req.cookies as any)?.[env.AUTH_COOKIE_NAME] as string | undefined;

  const bodyToken = (() => {
    try {
      return refreshBodySchema.parse(req.body).refreshToken;
    } catch {
      return undefined;
    }
  })();

  const refreshToken = cookieToken ?? bodyToken;
  if (refreshToken) {
    await authService.logout({ refreshToken });
  }

  clearRefreshCookie(res);
  return res.json({ ok: true });
};

export const me = async (req: Request, res: Response) => {
  const result = await authService.me(req.user!.id);
  return res.json(result.user);
};

export const twoFactorStatus = async (req: Request, res: Response) => {
  const result = await authService.twoFactorStatus(req.user!.id);
  return res.json(result);
};

export const enableTwoFactor = async (req: Request, res: Response) => {
  const input = twoFactorToggleBodySchema.parse(req.body);
  const result = await authService.enableTwoFactor({ userId: req.user!.id, password: input.password });
  return res.json(result);
};

export const disableTwoFactor = async (req: Request, res: Response) => {
  const input = twoFactorToggleBodySchema.parse(req.body);
  const result = await authService.disableTwoFactor({ userId: req.user!.id, password: input.password });
  return res.json(result);
};

export const forgotPassword = async (req: Request, res: Response) => {
  const input = forgotPasswordBodySchema.parse(req.body);
  const result = await authService.forgotPassword({
    email: input.email,
    requestedIp: req.ip,
    userAgent: req.headers['user-agent'],
  });
  return res.json(result);
};

export const resetPassword = async (req: Request, res: Response) => {
  const input = resetPasswordBodySchema.parse(req.body);
  const result = await authService.resetPassword(input);
  return res.json(result);
};
