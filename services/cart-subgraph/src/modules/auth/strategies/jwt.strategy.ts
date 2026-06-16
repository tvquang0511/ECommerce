import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfigService } from '../config/jwt.config';
import { AuthContextService } from '../auth-context.service';
import { AuthActor } from '../auth.types';

export type JwtPayload = {
  sub: string;
  email?: string;
  iat: number;
  exp: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly jwtConfig: JwtConfigService,
    private readonly authContextService: AuthContextService,
  ) {
    const publicKey = jwtConfig.getPublicKey();

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      secretOrKey: publicKey,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthActor> {
    const minimalActor: AuthActor = {
      userId: payload.sub,
      email: payload.email,
      roles: [],
      permissions: [],
      sellerProfile: null,
    };

    return minimalActor;
  }
}
