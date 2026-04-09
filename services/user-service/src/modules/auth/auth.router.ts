import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { authJwt } from '../../common/middlewares/authJwt.js';
import {
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
} from './auth.controller.js';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', authJwt, asyncHandler(me));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));

router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));

export default router;
