import prismaClientModule from "@prisma/client";
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../env.js";

const PrismaClientCtor = (
  prismaClientModule as unknown as {
    PrismaClient: new (options?: any) => PrismaClientType;
  }
).PrismaClient;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

function createPrismaClient() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient");
  }

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClientCtor({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
