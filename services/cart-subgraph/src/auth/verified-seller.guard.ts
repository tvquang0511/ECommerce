import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class VerifiedSellerGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requires = this.reflector.get<boolean>(
      'requiresVerifiedSeller',
      context.getHandler(),
    );
    if (!requires) return true;

    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    const actor = ctx?.actor;

    if (!actor) throw new UnauthorizedException('Actor missing in context');

    const hasSellerRole = Array.isArray(actor.roles) && actor.roles.includes('SELLER');
    const isVerified = actor.sellerProfile?.status === 'VERIFIED';
    const isKycVerified = actor.sellerProfile?.isKycVerified === true;

    if (!hasSellerRole || !isVerified || !isKycVerified) {
      throw new ForbiddenException('Verified seller required');
    }

    return true;
  }
}
