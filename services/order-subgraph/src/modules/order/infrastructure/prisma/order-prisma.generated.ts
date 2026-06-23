import path from 'node:path';

import type * as OrderPrismaModule from '../../../../../prisma/generated';

function resolveGeneratedPrismaModulePath() {
  return path.resolve(process.cwd(), 'prisma/generated');
}

const generatedPrisma = require(resolveGeneratedPrismaModulePath()) as typeof OrderPrismaModule;

export const PrismaClient = generatedPrisma.PrismaClient;
export const Prisma = generatedPrisma.Prisma;
