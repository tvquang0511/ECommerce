import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthContextService } from './auth-context.service';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  constructor(private readonly authContextService: AuthContextService) {
    super();
  }

  /**
   * Validate JWT and resolve full actor data (roles, permissions, seller status)
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // JWT strategy validates signature + expiry
    const result = await super.canActivate(context);
    if (!result) return false;

    // Extract request and actor (minimal, from JWT claims)
    const req = this.getRequest(context);
    let actor = req.user;

    // Call introspect to get full actor data (roles, permissions, seller status)
    // if JWT doesn't include these (which it shouldn't, for privacy)
    if (actor && (!actor.roles || actor.roles.length === 0)) {
      const token = this.extractToken(req);
      if (token) {
        try {
          actor = await this.authContextService.resolveActorFromIntrospect(token);
          req.user = actor;
        } catch (error) {
          // Introspect failed - propagate error
          throw error;
        }
      }
    }

    // Attach actor to GraphQL context for guards/resolvers
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    if (ctx) {
      ctx.actor = actor;
    }

    return true;
  }

  /**
   * Support both HTTP and GraphQL by unifying request object
   */
  getRequest(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const gqlContext = gqlCtx.getContext();
    if (gqlContext && gqlContext.req) return gqlContext.req;
    return context.switchToHttp().getRequest();
  }

  /**
   * Extract Bearer token from Authorization header
   */
  private extractToken(req: any): string | undefined {
    const header = req.headers?.authorization || req.header?.('authorization');
    if (!header) return undefined;
    const [kind, token] = header.split(' ');
    return kind === 'Bearer' ? token : undefined;
  }
}
