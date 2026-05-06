import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import { AuthContextService } from '../auth-context.service';

@Injectable()
export class UserServiceStrategy extends PassportStrategy(
  BearerStrategy,
  'user-service',
) {
  constructor(private readonly authContextService: AuthContextService) {
    super();
  }

  // passport-http-bearer provides the token
  async validate(token: string) {
    // validate should return the user object (attached to req.user)
    const actor = await this.authContextService.resolveActorFromToken(token);
    // passport expects either a user object or false
    return actor;
  }
}
