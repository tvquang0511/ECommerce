import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtConfigService {
  private cachedPublicKey: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  getPublicKey(): string {
    if (this.cachedPublicKey) {
      return this.cachedPublicKey;
    }

    const publicKeyPemB64 = this.configService.get<string>(
      'auth.jwtPublicKeyPemB64',
    );
    if (publicKeyPemB64) {
      this.cachedPublicKey = Buffer.from(publicKeyPemB64, 'base64').toString('utf8');
      return this.normalizeKey(this.cachedPublicKey);
    }

    const publicKeyPem = this.configService.get<string>('auth.jwtPublicKeyPem');
    if (publicKeyPem) {
      this.cachedPublicKey = publicKeyPem;
      return this.normalizeKey(this.cachedPublicKey);
    }

    throw new Error(
      'Missing JWT public key configuration. Set either JWT_CART_PUBLIC_KEY_PEM_B64 (Base64) or JWT_CART_PUBLIC_KEY_PEM (raw PEM)',
    );
  }

  private normalizeKey(keyStr: string): string {
    if (keyStr.includes('\\n')) {
      return keyStr.replace(/\\n/g, '\n');
    }
    return keyStr;
  }
}
