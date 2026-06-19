import { Router } from "express";
import { asyncHandler } from "../../common/middlewares/asyncHandler.js";
import { authJwt } from "../../common/middlewares/authJwt.js";
import {
  adminApproveSeller,
  adminBanSeller,
  adminListSellers,
  adminSuspendSeller,
} from "./admin.controller.js";

const router = Router();

router.get("/sellers", authJwt, asyncHandler(adminListSellers));
router.post(
  "/sellers/:sellerProfileId/approve",
  authJwt,
  asyncHandler(adminApproveSeller),
);
router.post(
  "/sellers/:sellerProfileId/suspend",
  authJwt,
  asyncHandler(adminSuspendSeller),
);
router.post("/sellers/:sellerProfileId/ban", authJwt, asyncHandler(adminBanSeller));

export default router;
