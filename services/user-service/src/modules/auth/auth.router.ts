import { Router } from "express";
import { asyncHandler } from "../../common/middlewares/asyncHandler.js";
import { authJwt } from "../../common/middlewares/authJwt.js";
import { rateLimit } from "../../common/middlewares/rateLimit.js";
import { env } from "../../env.js";
import {
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  forgotPassword,
  introspect,
  listSessions,
  login,
  logout,
  logoutAll,
  me,
  refresh,
  register,
  resendEmailVerification,
  revokeSession,
  resetPassword,
  twoFactorStatus,
  verifyEmail,
  verifyTwoFactor,
} from "./auth.controller.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.get(
  "/verify-email",
  rateLimit({
    name: "auth_verify_email_ip",
    limit: 20,
    windowSeconds: 60,
    identifiers: (req) => {
      return [`ip:${req.ip}`];
    },
  }),
  asyncHandler(verifyEmail),
);
router.post(
  "/verify-email/resend",
  rateLimit({
    name: "auth_verify_email_resend_ip",
    limit: 10,
    windowSeconds: 60 * 60,
    identifiers: (req) => {
      return [`ip:${req.ip}`];
    },
  }),
  asyncHandler(resendEmailVerification),
);
router.post(
  "/login",
  rateLimit({
    name: "auth_login_ip",
    limit: 10,
    windowSeconds: 60,
    identifiers: (req) => {
      return [`ip:${req.ip}`];
    },
  }),
  rateLimit({
    name: "auth_login_email",
    limit: 5,
    windowSeconds: 60,
    identifiers: (req) => {
      const email =
        typeof req.body?.email === "string"
          ? String(req.body.email).toLowerCase()
          : "";
      return email ? [`email:${email}`] : [];
    },
  }),
  asyncHandler(login),
);

router.post(
  "/2fa/verify",
  rateLimit({
    name: "auth_2fa_verify_ip",
    limit: 20,
    windowSeconds: 60,
    identifiers: (req) => {
      return [`ip:${req.ip}`];
    },
  }),
  rateLimit({
    name: "auth_2fa_verify_challenge",
    limit: 10,
    windowSeconds: 5 * 60,
    identifiers: (req) => {
      const challengeId =
        typeof req.body?.challengeId === "string"
          ? String(req.body.challengeId)
          : "";
      return challengeId ? [`challenge:${challengeId}`] : [];
    },
  }),
  asyncHandler(verifyTwoFactor),
);

router.get("/2fa", authJwt, asyncHandler(twoFactorStatus));
router.post("/2fa/enable", authJwt, asyncHandler(enableTwoFactor));
router.post("/2fa/disable", authJwt, asyncHandler(disableTwoFactor));

router.get("/sessions", authJwt, asyncHandler(listSessions));
router.post(
  "/sessions/:sessionId/revoke",
  authJwt,
  asyncHandler(revokeSession),
);
router.post("/logout-all", authJwt, asyncHandler(logoutAll));

router.get("/me", authJwt, asyncHandler(me));
router.post("/introspect", authJwt, asyncHandler(introspect));
router.post("/change-password", authJwt, asyncHandler(changePassword));
router.post(
  "/refresh",
  rateLimit({
    name: "auth_refresh_ip",
    limit: 120,
    windowSeconds: 60,
    identifiers: (req) => {
      return [`ip:${req.ip}`];
    },
  }),
  rateLimit({
    name: "auth_refresh_tokenId",
    limit: 60,
    windowSeconds: 60,
    identifiers: (req) => {
      const cookieToken = req.cookies?.[env.AUTH_COOKIE_NAME] as
        | string
        | undefined;
      const raw =
        cookieToken ??
        (typeof req.body?.refreshToken === "string"
          ? String(req.body.refreshToken)
          : undefined);
      const tokenId =
        raw && raw.includes(".") ? raw.slice(0, raw.indexOf(".")) : "";
      return tokenId ? [`tokenId:${tokenId}`] : [];
    },
  }),
  asyncHandler(refresh),
);
router.post("/logout", asyncHandler(logout));

router.post(
  "/forgot-password",
  rateLimit({
    name: "auth_forgot_password_ip",
    limit: 10,
    windowSeconds: 60 * 60,
    identifiers: (req) => {
      return [`ip:${req.ip}`];
    },
  }),
  rateLimit({
    name: "auth_forgot_password_email",
    limit: 3,
    windowSeconds: 60 * 60,
    identifiers: (req) => {
      const email =
        typeof req.body?.email === "string"
          ? String(req.body.email).toLowerCase()
          : "";
      return email ? [`email:${email}`] : [];
    },
  }),
  asyncHandler(forgotPassword),
);
router.post("/reset-password", asyncHandler(resetPassword));

export default router;
