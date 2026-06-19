import { ApiError } from "@repo/common/errors";
import { auditRepo } from "../audit/audit.repo.js";
import { sellersRepo } from "../sellers/sellers.repo.js";

type AdminAction =
  | "seller:list"
  | "seller:approve"
  | "seller:suspend"
  | "seller:ban";

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

function actorRoleNames(actor: {
  roles?: Array<{ role: { name: string } }>;
}): string[] {
  return (actor.roles ?? []).map((entry) => entry.role.name);
}

function canPerformAdminAction(
  roles: string[],
  action: AdminAction,
): boolean {
  if (roles.includes("SUPER_ADMIN")) return true;

  switch (action) {
    case "seller:list":
      return (
        roles.includes("ADMIN_MODERATOR") ||
        roles.includes("ADMIN_OPERATIONS") ||
        roles.includes("ADMIN_ANALYTICS")
      );
    case "seller:approve":
      return roles.includes("ADMIN_MODERATOR");
    case "seller:suspend":
    case "seller:ban":
      return (
        roles.includes("ADMIN_MODERATOR") ||
        roles.includes("ADMIN_OPERATIONS")
      );
    default:
      return false;
  }
}

function assertAdminActionAllowed(
  actor: { roles?: Array<{ role: { name: string } }> },
  action: AdminAction,
) {
  const roles = actorRoleNames(actor);
  if (!canPerformAdminAction(roles, action)) {
    throw new ApiError(403, "AUTH_FORBIDDEN", "Admin permission denied");
  }
}

export const adminService = {
  async listSellers(input: { actorUserId: string; status?: string }) {
    const actor = await sellersRepo.findUserById(input.actorUserId);
    if (!actor) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }
    assertAdminActionAllowed(actor, "seller:list");

    const sellers = await sellersRepo.listSellerProfiles(input.status);
    return {
      sellers: sellers.map((seller) => ({
        ...publicSellerProfile(seller)!,
        user: {
          id: seller.user.id,
          email: seller.user.email,
          displayName: seller.user.displayName,
          roles: seller.user.roles.map((entry) => entry.role.name),
        },
      })),
    };
  },

  async approveSeller(input: {
    actorUserId: string;
    sellerProfileId: string;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    const actor = await sellersRepo.findUserById(input.actorUserId);
    if (!actor) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }
    assertAdminActionAllowed(actor, "seller:approve");

    const seller = await sellersRepo.findSellerProfileById(input.sellerProfileId);
    if (!seller) {
      throw new ApiError(404, "SELLER_PROFILE_NOT_FOUND", "Seller not found");
    }
    if (seller.status !== "PENDING_VERIFICATION") {
      throw new ApiError(
        400,
        "SELLER_STATUS_INVALID",
        "Only pending sellers can be approved",
      );
    }

    const updated = await sellersRepo.updateSellerStatus({
      sellerProfileId: input.sellerProfileId,
      status: "VERIFIED",
      isKycVerified: true,
    });

    await writeAuditSafe({
      eventType: "SELLER_VERIFIED",
      actorUserId: actor.id,
      targetUserId: updated.userId,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        sellerProfileId: updated.id,
        shopName: updated.shopName,
      },
    });

    return { sellerProfile: publicSellerProfile(updated) };
  },

  async suspendSeller(input: {
    actorUserId: string;
    sellerProfileId: string;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    const actor = await sellersRepo.findUserById(input.actorUserId);
    if (!actor) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }
    assertAdminActionAllowed(actor, "seller:suspend");

    const seller = await sellersRepo.findSellerProfileById(input.sellerProfileId);
    if (!seller) {
      throw new ApiError(404, "SELLER_PROFILE_NOT_FOUND", "Seller not found");
    }

    const updated = await sellersRepo.updateSellerStatus({
      sellerProfileId: input.sellerProfileId,
      status: "SUSPENDED",
    });

    await writeAuditSafe({
      eventType: "SELLER_SUSPENDED",
      actorUserId: actor.id,
      targetUserId: updated.userId,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        sellerProfileId: updated.id,
        shopName: updated.shopName,
      },
    });

    return { sellerProfile: publicSellerProfile(updated) };
  },

  async banSeller(input: {
    actorUserId: string;
    sellerProfileId: string;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    const actor = await sellersRepo.findUserById(input.actorUserId);
    if (!actor) {
      throw new ApiError(401, "AUTH_TOKEN_INVALID", "User no longer exists");
    }
    assertAdminActionAllowed(actor, "seller:ban");

    const seller = await sellersRepo.findSellerProfileById(input.sellerProfileId);
    if (!seller) {
      throw new ApiError(404, "SELLER_PROFILE_NOT_FOUND", "Seller not found");
    }

    const updated = await sellersRepo.updateSellerStatus({
      sellerProfileId: input.sellerProfileId,
      status: "BANNED",
    });

    await writeAuditSafe({
      eventType: "SELLER_BANNED",
      actorUserId: actor.id,
      targetUserId: updated.userId,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      metadata: {
        sellerProfileId: updated.id,
        shopName: updated.shopName,
      },
    });

    return { sellerProfile: publicSellerProfile(updated) };
  },
};
