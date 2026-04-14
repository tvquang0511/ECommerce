import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '@repo/common/errors';

import { usersService } from './users.service.js';
import {
  putPublicObject,
  removePublicObject,
  tryParsePublicObjectNameFromUrl,
} from '../../common/media/minio.js';

const updateMeBodySchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional().nullable(),
    dateOfBirth: z
      .string()
      .optional()
      .nullable()
      .refine(
        (v) => {
          if (v === undefined || v === null || v === '') return true;
          return !Number.isNaN(Date.parse(v));
        },
        { message: 'dateOfBirth must be a valid date string' },
      ),
    phoneNumber: z.string().min(6).max(30).optional().nullable(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']).optional().nullable(),
  })
  .strict();

function extFromMime(mime: string) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return undefined;
}

export const usersMe = async (req: Request, res: Response) => {
  const result = await usersService.me(req.user!.id);
  return res.json(result.user);
};

export const usersUpdateMe = async (req: Request, res: Response) => {
  const input = updateMeBodySchema.parse(req.body);

  const dateOfBirth = (() => {
    if (input.dateOfBirth === undefined) return undefined;
    if (input.dateOfBirth === null || input.dateOfBirth === '') return null;
    const d = new Date(input.dateOfBirth);
    if (Number.isNaN(d.getTime())) return undefined;
    return d;
  })();

  const result = await usersService.updateMe(req.user!.id, {
    displayName: input.displayName,
    bio: input.bio,
    dateOfBirth,
    phoneNumber: input.phoneNumber,
    gender: input.gender,
  });
  return res.json(result.user);
};

export const usersUploadAvatar = async (req: Request, res: Response) => {
  const before = await usersService.me(req.user!.id);
  const previousObjectName = tryParsePublicObjectNameFromUrl(before.user.avatarUrl);

  const file = (req as any).file as
    | {
        buffer: Buffer;
        mimetype: string;
        size: number;
        originalname: string;
      }
    | undefined;

  if (!file) {
    throw new ApiError(400, 'AVATAR_MISSING', 'avatar file is required');
  }

  const ext = extFromMime(file.mimetype);
  if (!ext) {
    throw new ApiError(400, 'AVATAR_INVALID_TYPE', 'Only jpeg/png/webp are allowed');
  }

  const nonce = crypto.randomBytes(10).toString('hex');

  const objectName = `avatars/${req.user!.id}-${Date.now()}-${nonce}.${ext}`;

  let avatarUrl: string;
  try {
    const uploaded = await putPublicObject({
      objectName,
      body: file.buffer,
      size: file.size,
      contentType: file.mimetype,
    });
    avatarUrl = uploaded.url;
  } catch {
    throw new ApiError(500, 'AVATAR_STORAGE_FAILED', 'Failed to store avatar');
  }

  const result = await usersService.setAvatarUrl(req.user!.id, avatarUrl);

  if (previousObjectName && previousObjectName.startsWith('avatars/')) {
    // Best-effort cleanup: do not fail the request if deletion fails.
    removePublicObject(previousObjectName).catch(() => {
      // ignore
    });
  }

  return res.status(201).json(result.user);
};
