import { ApiError } from "@repo/common/errors";
import { auditRepo } from "../audit/audit.repo.js";
import { sellersRepo } from "./sellers.repo.js";

function publicSellerProfile(
  sellerProfile:
    | {
        id: string;
        userId: string;
        shopName: string;
        shopDesc: string | null;
        status: string;
        tier: string;
        isKycVerified: boolean;
        totalProducts: number;
        totalOrders: number;
        avgRating: number | null;
      }
    | null
    | undefined,
) {
  if (!sellerProfile) return null;
  return {
    id: sellerProfile.id,
    userId: sellerProfile.userId,
    shopName: sellerProfile.shopName,
    shopDesc: sellerProfile.shopDesc,
    status: sellerProfile.status,
    tier: sellerProfile.tier,
    isKycVerified: sellerProfile.isKycVerified,
    totalProducts: sellerProfile.totalProducts,
    totalOrders: sellerProfile.totalOrders,
    avgRating: sellerProfile.avgRating ?? null,
  };
}

async function writeAuditSafe(input: Parameters<typeof auditRepo.write>[0]) {
  try {
    await auditRepo.write(input);
  } catch (err) {
    console.error("[audit] failed to write audit log", err);
  }
}

export const sellersService = {
  async apply(input: {
    userId: string;
    shopName: string;
    shopDesc?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    const user = await sellersRepo.findUserById(input.userId);
    if (!user) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }

    if (!user.emailVerifiedAt) {
      throw new ApiError(
        403,
        "SELLER_EMAIL_NOT_VERIFIED",
        "Please verify your email before applying to become a seller",
      );
    }

    if (user.sellerProfile) {
      throw new ApiError(
        409,
        "SELLER_PROFILE_EXISTS",
        "Seller profile already exists",
      );
    }

    const sellerRole = await sellersRepo.findRoleByName("SELLER");
    if (!sellerRole) {
      throw new Error("SELLER role is missing. Run RBAC seed first.");
    }

    const sellerProfile = await sellersRepo.createSellerProfileAndAssignRole({
      userId: input.userId,
      shopName: input.shopName,
      shopDesc: input.shopDesc ?? null,
      sellerRoleId: sellerRole.id,
    });

    await writeAuditSafe({
      eventType: "SELLER_APPLIED",
      actorUserId: user.id,
      targetUserId: user.id,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        sellerProfileId: sellerProfile.id,
        shopName: sellerProfile.shopName,
      },
    });

    return { sellerProfile: publicSellerProfile(sellerProfile) };
  },

  async me(userId: string) {
    const user = await sellersRepo.findUserById(userId);
    if (!user) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }
    return { sellerProfile: publicSellerProfile(user.sellerProfile) };
  },
};
