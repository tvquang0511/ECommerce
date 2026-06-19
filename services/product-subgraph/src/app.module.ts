import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloFederationDriver, ApolloFederationDriverConfig } from '@nestjs/apollo';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configuration } from './configuration';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';

@Module({
  imports: [
    // ====== Global Config ======
    // Load configs (app/database/auth)
    ConfigModule.forRoot({
      isGlobal: true,
      load: configuration,
      cache: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // ====== MongoDB Connection ======
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          uri: configService.get<string>('database.mongoUri')!,
        };
      },
    }),

    // ====== GraphQL (Apollo) ======
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: {
        path: 'src/schema.gql',
        federation: 2,
      },
      sortSchema: true,
      // expose request on context so guards can access headers
      context: ({ req }: { req: any }) => ({ req }),
    }),

    AuthModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
