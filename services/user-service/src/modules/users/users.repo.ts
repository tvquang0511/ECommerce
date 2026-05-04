import { prisma } from "../../db/prisma.js";

const userRbacInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
  permissions: {
    include: {
      permission: true,
    },
  },
  sellerProfile: true,
} as const;

export const usersRepo = {
  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: userRbacInclude,
    });
  },

  updateMe(
    userId: string,
    data: {
      displayName?: string;
      bio?: string | null;
      dateOfBirth?: Date | null;
      phoneNumber?: string | null;
      gender?: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED" | null;
    },
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  },

  updateAvatarUrl(userId: string, avatarUrl: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });
  },
};
