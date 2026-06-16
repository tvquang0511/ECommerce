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
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    const actor = ctx?.actor;

    if (!actor) {
      throw new UnauthorizedException('Actor missing in context');
    }

    if (actor.roles?.includes('SUPER_ADMIN')) {
      return true;
    }

    const hasRole = requiredRoles.some((role: string) => {
      if (role.endsWith('*')) {
        const prefix = role.slice(0, -1);
        return actor.roles.some((r: string) => r.startsWith(prefix));
      }

      return actor.roles.includes(role);
    });

    if (!hasRole) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
