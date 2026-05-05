import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

import { AuthActor } from './auth-actor.type';

export type RequestLike = {
  header: (name: string) => string | undefined;
};

type MeResponse = {
  id: string;
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
  private readonly userServiceBaseUrl =
    process.env.USER_SERVICE_BASE_URL ?? 'http://localhost:4001';

  async getOptionalActor(req: RequestLike): Promise<AuthActor | null> {
    const devActor = this.getDevActor(req);
    if (devActor) {
      return devActor;
    }

    const token = this.extractBearerToken(req);
    if (!token) {
      return null;
    }

    return this.fetchActorFromUserService(token);
  }

  async getRequiredActor(req: RequestLike): Promise<AuthActor> {
    const actor = await this.getOptionalActor(req);
    if (!actor) {
      throw new UnauthorizedException('Missing or invalid access token');
    }

    return actor;
  }

  ensureAdmin(actor: AuthActor): void {
    if (!this.isAdmin(actor)) {
      throw new ForbiddenException('Admin role required');
    }
  }

  ensureVerifiedSeller(actor: AuthActor): void {
    const hasSellerRole = actor.roles.includes('SELLER');
    const isVerified = actor.sellerProfile?.status === 'VERIFIED';
    const isKycVerified = actor.sellerProfile?.isKycVerified === true;

    if (!hasSellerRole || !isVerified || !isKycVerified) {
      throw new ForbiddenException(
        'Verified seller role is required to perform this action',
      );
    }
  }

  isAdmin(actor: AuthActor): boolean {
    return actor.roles.some((role) => role.startsWith('ADMIN_') || role === 'SUPER_ADMIN');
  }

  private extractBearerToken(req: RequestLike): string | undefined {
    const authorization = req.header('authorization');
    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }

  private getDevActor(req: RequestLike): AuthActor | null {
    if (process.env.NODE_ENV !== 'test') {
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
            isKycVerified: isKycVerified,
          }
        : null,
    };
  }

  private async fetchActorFromUserService(token: string): Promise<AuthActor> {
    const response = await fetch(`${this.userServiceBaseUrl}/api/users/auth/me`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Access token invalid or expired');
    }

    const data = (await response.json()) as MeResponse;
    if (!data.id) {
      throw new UnauthorizedException('Cannot resolve user identity');
    }

    return {
      userId: data.id,
      email: data.email,
      roles: data.roles ?? [],
      permissions: data.permissions ?? [],
      sellerProfile: data.sellerProfile
        ? {
            status: data.sellerProfile.status,
            isKycVerified: data.sellerProfile.isKycVerified,
          }
        : null,
    };
  }
}
