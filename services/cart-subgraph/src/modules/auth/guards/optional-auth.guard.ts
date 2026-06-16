import { ExecutionContext, Injectable } from '@nestjs/common';

import { AuthGuard } from './auth.guard';

@Injectable()
export class OptionalAuthGuard extends AuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = this.getRequest(context);

    const devActor = this.authContextService.getDevActor(req);
    if (devActor) {
      req.user = devActor;
      this.attachActorToContext(context, devActor);
      return true;
    }

    const token = this.extractToken(req);
    if (!token) {
      this.attachActorToContext(context, null);
      return true;
    }

    return super.canActivate(context);
  }
}
