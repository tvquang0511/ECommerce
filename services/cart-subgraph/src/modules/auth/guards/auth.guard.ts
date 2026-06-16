import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthContextService } from '../auth-context.service';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  constructor(protected readonly authContextService: AuthContextService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = this.getRequest(context);

    const devActor = this.authContextService.getDevActor(req);
    if (devActor) {
      req.user = devActor;
      this.attachActorToContext(context, devActor);
      return true;
    }

    const result = await super.canActivate(context);
    if (!result) return false;

    let actor = req.user;

    if (actor && (!actor.roles || actor.roles.length === 0)) {
      const token = this.extractToken(req);
      if (token) {
        actor = await this.authContextService.resolveActorFromIntrospect(token);
        req.user = actor;
      }
    }

    this.attachActorToContext(context, actor ?? null);

    return true;
  }

  getRequest(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const gqlContext = gqlCtx.getContext();
    if (gqlContext && gqlContext.req) return gqlContext.req;
    return context.switchToHttp().getRequest();
  }

  protected extractToken(req: any): string | undefined {
    const header = req.headers?.authorization || req.header?.('authorization');
    if (!header) return undefined;
    const [kind, token] = header.split(' ');
    return kind === 'Bearer' ? token : undefined;
  }

  protected attachActorToContext(
    context: ExecutionContext,
    actor: unknown | null,
  ): void {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    if (ctx) {
      ctx.actor = actor ?? null;
    }
  }
}
