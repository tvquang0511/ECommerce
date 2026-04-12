import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '@repo/common/errors';
import { getAccessJwtKeys } from '../../modules/auth/jwtKeys.js';

type JwtAccessPayload = {
  sub: string;
  email?: string;
};

function getBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [kind, token] = header.split(' ');
  if (kind !== 'Bearer' || !token) return undefined;
  return token;
}

export function authJwt(req: Request, _res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) {
    return next(new ApiError(401, 'AUTH_UNAUTHORIZED', 'Missing Authorization header'));
  }

  try {
    const { publicKeyPem } = getAccessJwtKeys();
    const payload = jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] }) as JwtAccessPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
    };
    return next();
  } catch (e: any) {
    if (e?.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'AUTH_TOKEN_EXPIRED', 'Access token expired'));
    }
    return next(new ApiError(401, 'AUTH_TOKEN_INVALID', 'Access token invalid'));
  }
}
