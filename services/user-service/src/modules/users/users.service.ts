import { ApiError } from '@repo/common/errors';
import { usersRepo } from './users.repo.js';

function publicUser(user: {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  dateOfBirth?: Date | null;
  phoneNumber?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED' | null;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    phoneNumber: user.phoneNumber ?? null,
    gender: user.gender ?? null,
  };
}

export const usersService = {
  async me(userId: string) {
    const user = await usersRepo.findUserById(userId);
    if (!user) {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'User no longer exists');
    }
    return { user: publicUser(user) };
  },

  async updateMe(
    userId: string,
    input: {
      displayName?: string | undefined;
      bio?: string | null | undefined;
      dateOfBirth?: Date | null | undefined;
      phoneNumber?: string | null | undefined;
      gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED' | null | undefined;
    },
  ) {
    const user = await usersRepo.findUserById(userId);
    if (!user) {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'User no longer exists');
    }

    const data: Parameters<typeof usersRepo.updateMe>[1] = {};

    if (typeof input.displayName === 'string') {
      const trimmed = input.displayName.trim();
      if (trimmed) data.displayName = trimmed;
    }

    if (input.bio !== undefined) {
      data.bio = typeof input.bio === 'string' ? input.bio.trim() : input.bio;
    }

    if (input.dateOfBirth !== undefined) {
      data.dateOfBirth = input.dateOfBirth;
    }

    if (input.phoneNumber !== undefined) {
      data.phoneNumber = typeof input.phoneNumber === 'string' ? input.phoneNumber.trim() : input.phoneNumber;
    }

    if (input.gender !== undefined) {
      data.gender = input.gender;
    }

    const updated = await usersRepo.updateMe(userId, data);
    return { user: publicUser(updated) };
  },

  async setAvatarUrl(userId: string, avatarUrl: string | null) {
    const user = await usersRepo.findUserById(userId);
    if (!user) {
      throw new ApiError(401, 'AUTH_TOKEN_INVALID', 'User no longer exists');
    }

    const updated = await usersRepo.updateAvatarUrl(userId, avatarUrl);
    return { user: publicUser(updated) };
  },
};
