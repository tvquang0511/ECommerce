import path from 'node:path';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type * as OrderPrismaModule from '../../../../../prisma/.client';

function resolveGeneratedPrismaModulePath() {
  return path.resolve(process.cwd(), 'prisma/.client');
}

const generatedPrisma = require(resolveGeneratedPrismaModulePath()) as typeof OrderPrismaModule;
const PrismaClient = generatedPrisma.PrismaClient;

@Injectable()
export class OrderPrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('order.databaseUrl');
    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
