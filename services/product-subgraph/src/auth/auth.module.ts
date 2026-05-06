import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthContextService } from './auth-context.service';
import { UserServiceStrategy } from './strategies/user-service.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'user-service', session: false })],
  providers: [AuthContextService, UserServiceStrategy],
  exports: [AuthContextService],
})
export class AuthModule {}
