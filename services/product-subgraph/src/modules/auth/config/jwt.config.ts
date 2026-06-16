import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * JWT Configuration Service
 * Loads and caches RS256 public key from environment
 *
 * Supports two environment variable formats:
 * 1. JWT_PRODUCT_PUBLIC_KEY_PEM_B64: Base64-encoded PEM key (recommended for env files)
 * 2. JWT_PRODUCT_PUBLIC_KEY_PEM: Raw PEM-formatted key (literal \n characters)
 */
@Injectable()
export class JwtConfigService {
  private cachedPublicKey: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get RS256 public key for JWT verification
   * Caches result in memory after first load
   *
   * @throws Error if neither env var is set
   */
  getPublicKey(): string {
    if (this.cachedPublicKey) {
      return this.cachedPublicKey;
    }

    // Try Base64-encoded key first (recommended)
    const publicKeyPemB64 = this.configService.get<string>(
      'auth.jwtPublicKeyPemB64',
    );
    if (publicKeyPemB64) {
      this.cachedPublicKey = Buffer.from(publicKeyPemB64, 'base64').toString('utf8');
      return this.normalizeKey(this.cachedPublicKey);
    }

    // Try raw PEM key (fallback)
    const publicKeyPem = this.configService.get<string>('auth.jwtPublicKeyPem');
    if (publicKeyPem) {
      this.cachedPublicKey = publicKeyPem;
      return this.normalizeKey(this.cachedPublicKey);
    }

    // Both missing
    throw new Error(
      'Missing JWT public key configuration. Set either JWT_PRODUCT_PUBLIC_KEY_PEM_B64 (Base64) or JWT_PRODUCT_PUBLIC_KEY_PEM (raw PEM)',
    );
  }

  /**
   * Normalize PEM key: handle literal \n in env vars
   * @example "-----BEGIN PUBLIC KEY-----\nMIIBIjANB...\n-----END PUBLIC KEY-----"
   */
  private normalizeKey(keyStr: string): string {
    // If env var contains literal \n (as string), replace with actual newlines
    if (keyStr.includes('\\n')) {
      return keyStr.replace(/\\n/g, '\n');
    }
    return keyStr;
  }
}
