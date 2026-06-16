import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * PermissionGuard checks if the actor has required permissions
 * Permissions are resolved from user-service during AuthGuard introspection
 * Uses @RequiresPermissions('PERMISSION_NAME') metadata
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>('permissions', context.getHandler());
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    const actor = ctx?.actor;

    if (!actor) {
      throw new UnauthorizedException('Actor missing in context');
    }

    const actorPermissions = actor.permissions ?? [];

    const hasPermission = requiredPermissions.some((permission: string) => {
      if (permission.endsWith('*')) {
        const prefix = permission.slice(0, -1);
        return actorPermissions.some((p: string) => p.startsWith(prefix));
      }

      return actorPermissions.includes(permission);
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
