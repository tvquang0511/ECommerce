import { Router } from "express";
import { asyncHandler } from "../../common/middlewares/asyncHandler.js";
import { authJwt } from "../../common/middlewares/authJwt.js";
import { applySeller, sellerMe } from "./sellers.controller.js";

const router = Router();

router.post("/seller/apply", authJwt, asyncHandler(applySeller));
router.get("/seller/me", authJwt, asyncHandler(sellerMe));

export default router;
