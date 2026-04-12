import { Router } from 'express';
import { asyncHandler } from '../../common/middlewares/asyncHandler.js';
import { authJwt } from '../../common/middlewares/authJwt.js';
import {
  disableTwoFactor,
  enableTwoFactor,
  forgotPassword,
  login,
  logout,
  me,
  refresh,
  register,
  resetPassword,
  twoFactorStatus,
  verifyTwoFactor,
} from './auth.controller.js';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/2fa/verify', asyncHandler(verifyTwoFactor));
router.get('/2fa', authJwt, asyncHandler(twoFactorStatus));
router.post('/2fa/enable', authJwt, asyncHandler(enableTwoFactor));
router.post('/2fa/disable', authJwt, asyncHandler(disableTwoFactor));
router.get('/me', authJwt, asyncHandler(me));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));

router.post('/forgot-password', asyncHandler(forgotPassword));
router.post('/reset-password', asyncHandler(resetPassword));

export default router;
