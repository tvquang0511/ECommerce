import type { Request, Response } from "express";
import { z } from "zod";
import { adminService } from "./admin.service.js";

const listSellersQuerySchema = z.object({
  status: z
    .enum(["PENDING_VERIFICATION", "VERIFIED", "SUSPENDED", "BANNED"])
    .optional(),
});

export const adminListSellers = async (req: Request, res: Response) => {
  const query = listSellersQuerySchema.parse(req.query);
  const result = await adminService.listSellers({
    actorUserId: req.user!.id,
    status: query.status,
  });
  return res.json(result);
};

export const adminApproveSeller = async (req: Request, res: Response) => {
  const sellerProfileId = String(req.params.sellerProfileId ?? "");
  const result = await adminService.approveSeller({
    actorUserId: req.user!.id,
    sellerProfileId,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  return res.json(result);
};

export const adminSuspendSeller = async (req: Request, res: Response) => {
  const sellerProfileId = String(req.params.sellerProfileId ?? "");
  const result = await adminService.suspendSeller({
    actorUserId: req.user!.id,
    sellerProfileId,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  return res.json(result);
};

export const adminBanSeller = async (req: Request, res: Response) => {
  const sellerProfileId = String(req.params.sellerProfileId ?? "");
  const result = await adminService.banSeller({
    actorUserId: req.user!.id,
    sellerProfileId,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  return res.json(result);
};
