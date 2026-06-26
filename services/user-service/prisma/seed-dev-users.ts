import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./.client/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for prisma seed");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD ?? "DevPassword123!";

type DemoUserSeed = {
  email: string;
  displayName: string;
  roles: string[];
  emailVerified: boolean;
  twoFactorEnabled?: boolean;
  sellerProfile?: {
    shopName: string;
    shopDesc?: string;
    status: "PENDING_VERIFICATION" | "VERIFIED" | "SUSPENDED" | "BANNED";
    tier?: "INDIVIDUAL" | "MERCHANT" | "BRAND_PARTNER" | "PREMIUM";
    isKycVerified?: boolean;
    totalProducts?: number;
    totalOrders?: number;
    avgRating?: number | null;
  };
};

const demoUsers: DemoUserSeed[] = [
  {
    email: "buyer@demo.local",
    displayName: "Demo Buyer",
    roles: ["BUYER"],
    emailVerified: true,
  },
  {
    email: "seller-pending@demo.local",
    displayName: "Pending Seller",
    roles: ["BUYER", "SELLER"],
    emailVerified: true,
    sellerProfile: {
      shopName: "pending-shop",
      shopDesc: "Shop đang chờ admin duyệt",
      status: "PENDING_VERIFICATION",
      tier: "INDIVIDUAL",
      isKycVerified: false,
      totalProducts: 0,
      totalOrders: 0,
      avgRating: null,
    },
  },
  {
    email: "seller@demo.local",
    displayName: "Verified Seller",
    roles: ["BUYER", "SELLER"],
    emailVerified: true,
    sellerProfile: {
      shopName: "verified-shop",
      shopDesc: "Shop mẫu đã được duyệt",
      status: "VERIFIED",
      tier: "MERCHANT",
      isKycVerified: true,
      totalProducts: 12,
      totalOrders: 48,
      avgRating: 4.7,
    },
  },
  {
    email: "admin@demo.local",
    displayName: "Super Admin",
    roles: ["SUPER_ADMIN"],
    emailVerified: true,
  },
  {
    email: "moderator@demo.local",
    displayName: "Admin Moderator",
    roles: ["ADMIN_MODERATOR"],
    emailVerified: true,
  },
  {
    email: "ops@demo.local",
    displayName: "Admin Operations",
    roles: ["ADMIN_OPERATIONS"],
    emailVerified: true,
  },
  {
    email: "analytics@demo.local",
    displayName: "Admin Analytics",
    roles: ["ADMIN_ANALYTICS"],
    emailVerified: true,
  },
  {
    email: "unverified@demo.local",
    displayName: "Unverified User",
    roles: ["BUYER"],
    emailVerified: false,
  },
  {
    email: "2fa@demo.local",
    displayName: "Two Factor User",
    roles: ["BUYER"],
    emailVerified: true,
    twoFactorEnabled: true,
  },
];

async function syncUserRoles(userId: string, roleNames: string[]) {
  const roles = await prisma.role.findMany({
    where: { name: { in: roleNames } },
    select: { id: true, name: true },
  });

  const missingRoles = roleNames.filter(
    (roleName) => !roles.some((role) => role.name === roleName),
  );
  if (missingRoles.length > 0) {
    throw new Error(
      `Missing roles: ${missingRoles.join(", ")}. Run prisma/seed.ts first.`,
    );
  }

  await prisma.userRole.deleteMany({ where: { userId } });

  await prisma.userRole.createMany({
    data: roles.map((role) => ({
      userId,
      roleId: role.id,
    })),
    skipDuplicates: true,
  });
}

async function syncSellerProfile(
  userId: string,
  sellerProfile: DemoUserSeed["sellerProfile"],
) {
  if (!sellerProfile) {
    await prisma.sellerProfile.deleteMany({ where: { userId } });
    return;
  }

  await prisma.sellerProfile.upsert({
    where: { userId },
    update: {
      shopName: sellerProfile.shopName,
      shopDesc: sellerProfile.shopDesc ?? null,
      status: sellerProfile.status,
      tier: sellerProfile.tier ?? "INDIVIDUAL",
      isKycVerified: sellerProfile.isKycVerified ?? false,
      totalProducts: sellerProfile.totalProducts ?? 0,
      totalOrders: sellerProfile.totalOrders ?? 0,
      avgRating: sellerProfile.avgRating ?? null,
    },
    create: {
      userId,
      shopName: sellerProfile.shopName,
      shopDesc: sellerProfile.shopDesc ?? null,
      status: sellerProfile.status,
      tier: sellerProfile.tier ?? "INDIVIDUAL",
      isKycVerified: sellerProfile.isKycVerified ?? false,
      totalProducts: sellerProfile.totalProducts ?? 0,
      totalOrders: sellerProfile.totalOrders ?? 0,
      avgRating: sellerProfile.avgRating ?? null,
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        displayName: demoUser.displayName,
        passwordHash,
        twoFactorEnabled: demoUser.twoFactorEnabled ?? false,
        emailVerifiedAt: demoUser.emailVerified ? new Date() : null,
      },
      create: {
        email: demoUser.email,
        displayName: demoUser.displayName,
        passwordHash,
        twoFactorEnabled: demoUser.twoFactorEnabled ?? false,
        emailVerifiedAt: demoUser.emailVerified ? new Date() : null,
      },
    });

    await syncUserRoles(user.id, demoUser.roles);
    await syncSellerProfile(user.id, demoUser.sellerProfile);
  }

  console.log(
    `[seed-dev-users] Seeded ${demoUsers.length} demo users with password: ${DEV_PASSWORD}`,
  );
}

main()
  .catch((error) => {
    console.error("[seed-dev-users] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
