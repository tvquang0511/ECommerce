import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthContextService } from './auth-context.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtConfigService } from './config/jwt.config';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionGuard } from './guards/permission.guard';
import { VerifiedSellerGuard } from './guards/verified-seller.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
  ],
  providers: [
    JwtConfigService,
    JwtStrategy,
    AuthContextService,
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    PermissionGuard,
    VerifiedSellerGuard,
  ],
  exports: [
    AuthContextService,
    AuthGuard,
    OptionalAuthGuard,
    RolesGuard,
    PermissionGuard,
    VerifiedSellerGuard,
  ],
})
export class AuthModule {}
