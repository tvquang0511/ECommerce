import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfigService } from '../config/jwt.config';
import { AuthContextService } from '../auth-context.service';
import { AuthActor } from '../auth.types';

/**
 * JWT payload from user-service
 * Token signed with RS256, issued by user-service
 */
export type JwtPayload = {
  sub: string; // user ID
  email?: string;
  iat: number; // issued at
  exp: number; // expiration
};

/**
 * Passport JWT Strategy for RS256 verification
 * - Extracts Bearer token from Authorization header
 * - Verifies signature using RS256 public key
 * - Decodes payload → minimal actor data (userId, email)
 * - Calls AuthContextService.resolveActorFromIntrospect() to get full actor (roles, permissions, seller status)
 */
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
      ignoreExpiration: false, // Enforce token expiry
    });
  }

  /**
   * Validate JWT after signature verification by Passport
   * At this point, JWT is already verified (signature checked, expiry validated)
   *
   * Passport calls this with the decoded payload
   * Return value is attached to req.user by Passport
   */
  async validate(payload: JwtPayload): Promise<AuthActor> {
    // JWT verified by Passport, now extract actor data
    // Start with minimal actor from JWT claims
    const minimalActor: AuthActor = {
      userId: payload.sub,
      email: payload.email,
      roles: [],
      permissions: [],
      sellerProfile: null,
    };

    // Return minimal actor
    // AuthGuard will call introspect to fill in roles/permissions/seller status
    return minimalActor;
  }
}
