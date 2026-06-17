import {
  Injectable,
  UnauthorizedException,
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthActor } from './auth.types';

export type RequestLike = {
  header: (name: string) => string | undefined;
};

type IntrospectResponse = {
  userId: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  sellerProfile?: {
    status: string;
    isKycVerified: boolean;
  } | null;
};

@Injectable()
export class AuthContextService {
  constructor(private readonly configService: ConfigService) {}

  async resolveActorFromIntrospect(token: string): Promise<AuthActor> {
    const userServiceBaseUrl =
      this.configService.get<string>('auth.userServiceBaseUrl') ??
      'http://localhost:4001';
    const requestTimeoutMs =
      this.configService.get<number>('auth.requestTimeoutMs') ?? 5000;

    const baseUrl = userServiceBaseUrl.replace(/\/+$/g, '');
    const url = `${baseUrl}/api/users/auth/introspect`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        throw new ServiceUnavailableException('User-service request timed out');
      }

      throw new BadGatewayException('Cannot reach user-service');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException('Access token invalid or expired');
      }

      throw new BadGatewayException('User-service error while resolving identity');
    }

    let data: IntrospectResponse;
    try {
      data = (await response.json()) as IntrospectResponse;
    } catch {
      throw new BadGatewayException('Invalid response from user-service');
    }

    if (
      !data ||
      typeof data !== 'object' ||
      typeof data.userId !== 'string' ||
      !data.userId
    ) {
      throw new UnauthorizedException('Cannot resolve user identity');
    }

    const roles = Array.isArray(data.roles)
      ? data.roles.filter((value): value is string => typeof value === 'string')
      : [];
    const permissions = Array.isArray(data.permissions)
      ? data.permissions.filter((value): value is string => typeof value === 'string')
      : [];

    const sellerProfile = (() => {
      if (!data.sellerProfile) {
        return null;
      }

      const status = data.sellerProfile.status;
      const isKycVerified = data.sellerProfile.isKycVerified;
      if (typeof status !== 'string' || typeof isKycVerified !== 'boolean') {
        return null;
      }

      return { status, isKycVerified };
    })();

    return {
      userId: data.userId,
      email: data.email,
      roles,
      permissions,
      sellerProfile,
    };
  }

  async resolveActorFromToken(token: string): Promise<AuthActor> {
    return this.resolveActorFromIntrospect(token);
  }

  getDevActor(req: RequestLike): AuthActor | null {
    const allowTestHeaders =
      this.configService.get<boolean>('auth.allowTestHeaders') ?? false;
    if (!allowTestHeaders) {
      return null;
    }

    const userId = req.header('x-dev-user-id');
    if (!userId) {
      return null;
    }

    const roles = (req.header('x-dev-roles') ?? '')
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean);
    const permissions = (req.header('x-dev-permissions') ?? '')
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean);

    const sellerStatus = req.header('x-dev-seller-status');
    const kycHeader = req.header('x-dev-kyc-verified');
    const isKycVerified = kycHeader ? kycHeader.toLowerCase() === 'true' : false;

    return {
      userId,
      email: req.header('x-dev-email') ?? undefined,
      roles,
      permissions,
      sellerProfile: sellerStatus
        ? {
            status: sellerStatus,
            isKycVerified,
          }
        : null,
    };
  }

  extractBearerToken(req: RequestLike): string | undefined {
    const authorization = req.header('authorization');
    if (!authorization) {
      return undefined;
    }

    const match = /^Bearer\s+(.+)$/.exec(authorization.trim());
    if (!match) {
      return undefined;
    }

    const token = match[1].trim();
    return token ? token : undefined;
  }
}
