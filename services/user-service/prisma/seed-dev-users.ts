import bcrypt from "bcryptjs";

import { prisma } from "../src/db/prisma.js";

type DevUserSeed = {
  email: string;
  displayName: string;
  roles: string[];
  sellerProfile?: {
    shopName: string;
    shopDesc?: string | null;
    status: "PENDING_VERIFICATION" | "VERIFIED" | "SUSPENDED" | "BANNED";
    tier: "INDIVIDUAL" | "MERCHANT" | "BRAND_PARTNER" | "PREMIUM";
    isKycVerified: boolean;
  };
};

async function ensureRole(roleName: string) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new Error(
      `Missing role '${roleName}'. Run RBAC seed first: pnpm prisma:seed`,
    );
  }
  return role;
}

async function ensureUserRole(userId: string, roleId: string) {
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

async function upsertUser(seed: DevUserSeed, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: seed.email },
    update: {
      displayName: seed.displayName,
      passwordHash,
    },
    create: {
      email: seed.email,
      displayName: seed.displayName,
      passwordHash,
    },
  });

  for (const roleName of seed.roles) {
    const role = await ensureRole(roleName);
    await ensureUserRole(user.id, role.id);
  }

  if (seed.sellerProfile) {
    await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      update: {
        shopName: seed.sellerProfile.shopName,
        shopDesc: seed.sellerProfile.shopDesc ?? null,
        status: seed.sellerProfile.status,
        tier: seed.sellerProfile.tier,
        isKycVerified: seed.sellerProfile.isKycVerified,
      },
      create: {
        userId: user.id,
        shopName: seed.sellerProfile.shopName,
        shopDesc: seed.sellerProfile.shopDesc ?? null,
        status: seed.sellerProfile.status,
        tier: seed.sellerProfile.tier,
        isKycVerified: seed.sellerProfile.isKycVerified,
      },
    });
  }

  return user;
}

async function main() {
  const password = process.env.DEV_SEED_PASSWORD ?? "DevPassword123!";

  const users: DevUserSeed[] = [
    {
      email: "buyer@demo.local",
      displayName: "Demo Buyer",
      roles: ["BUYER"],
    },
    {
      email: "seller@demo.local",
      displayName: "Demo Seller",
      roles: ["BUYER", "SELLER"],
      sellerProfile: {
        shopName: "demo-shop-seller",
        shopDesc: "Demo shop for local testing",
        status: "VERIFIED",
        tier: "INDIVIDUAL",
        isKycVerified: true,
      },
    },
    {
      email: "admin@demo.local",
      displayName: "Demo Admin",
      roles: ["SUPER_ADMIN"],
    },
  ];

  // Ensure shopName uniqueness if you run multiple environments against same DB.
  // If conflict happens, just change the shopName above.

  for (const userSeed of users) {
    const user = await upsertUser(userSeed, password);
    console.log(`Seeded user: ${user.email} (id=${user.id})`);
  }

  console.log("Dev users seed completed successfully");
  console.log(`Login password (all demo users): ${password}`);
}

main()
  .catch((error) => {
    console.error("Dev users seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
