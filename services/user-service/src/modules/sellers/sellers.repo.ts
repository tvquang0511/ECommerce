import { prisma } from "../../db/prisma.js";

const sellerUserInclude = {
  roles: {
    include: {
      role: true,
    },
  },
  permissions: {
    include: {
      permission: true,
    },
  },
  sellerProfile: true,
} as const;

export const sellersRepo = {
  findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      include: sellerUserInclude,
    });
  },

  findRoleByName(name: string) {
    return prisma.role.findUnique({ where: { name } });
  },

  findSellerProfileByUserId(userId: string) {
    return prisma.sellerProfile.findUnique({
      where: { userId },
    });
  },

  listSellerProfiles(status?: string) {
    return prisma.sellerProfile.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findSellerProfileById(id: string) {
    return prisma.sellerProfile.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });
  },

  async createSellerProfileAndAssignRole(input: {
    userId: string;
    shopName: string;
    shopDesc?: string | null;
    sellerRoleId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const sellerProfile = await tx.sellerProfile.create({
        data: {
          userId: input.userId,
          shopName: input.shopName,
          shopDesc: input.shopDesc ?? null,
          status: "PENDING_VERIFICATION",
          tier: "INDIVIDUAL",
          isKycVerified: false,
        },
      });

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: input.userId,
            roleId: input.sellerRoleId,
          },
        },
        update: {},
        create: {
          userId: input.userId,
          roleId: input.sellerRoleId,
        },
      });

      return sellerProfile;
    });
  },

  updateSellerStatus(input: {
    sellerProfileId: string;
    status: "VERIFIED" | "SUSPENDED" | "BANNED";
    isKycVerified?: boolean;
  }) {
    return prisma.sellerProfile.update({
      where: { id: input.sellerProfileId },
      data: {
        status: input.status,
        ...(input.isKycVerified === undefined
          ? {}
          : { isKycVerified: input.isKycVerified }),
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });
  },
};
