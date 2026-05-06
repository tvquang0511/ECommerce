import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthContextService } from './auth-context.service';

@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(private readonly authContextService: AuthContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    const req = ctx?.req;

    if (!req) {
      throw new UnauthorizedException('No request available in GraphQL context');
    }

    const actor = await this.authContextService.getRequiredActor(req);

    // attach actor onto GraphQL context for downstream guards/resolvers
    ctx.actor = actor;

    return true;
  }
}
