import type { PrismaClient as PrismaClientType } from "@prisma/client";
import prismaClientModule from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../env.js";

// Properly type the PrismaClient constructor
const PrismaClient = prismaClientModule.PrismaClient as unknown as {
  new (options?: any): PrismaClientType;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClientType };

function createPrismaClient() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient");
  }

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
