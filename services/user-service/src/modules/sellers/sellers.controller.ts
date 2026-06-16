import type { Request, Response } from "express";
import { z } from "zod";
import { sellersService } from "./sellers.service.js";

const applySellerBodySchema = z.object({
  shopName: z.string().min(3).max(100),
  shopDesc: z.string().max(500).optional().nullable(),
});

export const applySeller = async (req: Request, res: Response) => {
  const input = applySellerBodySchema.parse(req.body);
  const result = await sellersService.apply({
    userId: req.user!.id,
    shopName: input.shopName.trim(),
    shopDesc: input.shopDesc?.trim() ?? input.shopDesc,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });
  return res.status(201).json(result);
};

export const sellerMe = async (req: Request, res: Response) => {
  const result = await sellersService.me(req.user!.id);
  return res.json(result);
};
