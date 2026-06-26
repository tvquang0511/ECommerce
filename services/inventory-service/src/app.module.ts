import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { configuration } from './configuration';
import { InventoryModule } from './modules/inventory/inventory.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configuration,
      cache: true,
      envFilePath: ['.env', '.env.local'],
    }),
    InventoryModule,
  ],
})
export class AppModule {}
