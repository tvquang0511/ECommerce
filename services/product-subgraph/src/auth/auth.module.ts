import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthContextService } from './auth-context.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtConfigService } from './config/jwt.config';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { PermissionGuard } from './permission.guard';
import { VerifiedSellerGuard } from './verified-seller.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
  ],
  providers: [JwtConfigService, JwtStrategy, AuthContextService, AuthGuard, RolesGuard, PermissionGuard, VerifiedSellerGuard],
  exports: [AuthContextService, AuthGuard, RolesGuard, PermissionGuard, VerifiedSellerGuard],
})
export class AuthModule {}
