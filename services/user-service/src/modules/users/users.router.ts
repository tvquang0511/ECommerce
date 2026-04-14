import { Router } from 'express';
import multer from 'multer';
import { ApiError } from '@repo/common/errors';

import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { authJwt } from '../../common/middlewares/authJwt.js';
import { usersMe, usersUpdateMe, usersUploadAvatar } from './users.controller.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

function uploadAvatar(req: any, res: any, next: any) {
  upload.single('avatar')(req, res, (err: any) => {
    if (!err) return next();

    if (err?.name === 'MulterError' && err?.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'AVATAR_TOO_LARGE', 'Avatar too large (max 2MB)'));
    }

    return next(new ApiError(400, 'AVATAR_UPLOAD_FAILED', 'Avatar upload failed'));
  });
}

router.get('/me', authJwt, asyncHandler(usersMe));
router.patch('/me', authJwt, asyncHandler(usersUpdateMe));
router.post('/me/avatar', authJwt, uploadAvatar, asyncHandler(usersUploadAvatar));

export default router;
