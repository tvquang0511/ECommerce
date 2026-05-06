import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class AuthGuard extends PassportAuthGuard('user-service') {
  // Support both HTTP and GraphQL by unifying the request object
  getRequest(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const gqlContext = gqlCtx.getContext();
    // If GraphQL context.req exists, use it; otherwise fall back to HTTP
    if (gqlContext && gqlContext.req) return gqlContext.req;
    return context.switchToHttp().getRequest();
  }
}
