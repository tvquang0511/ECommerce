import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../prisma/generated/index.js";

import { env } from "../env.js";

type PrismaClientType = PrismaClient;

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
