import { prisma } from "../../db/prisma.js";

export const usersRepo = {
  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
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
