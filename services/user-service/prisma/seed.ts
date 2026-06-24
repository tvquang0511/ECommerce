import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for prisma seed");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type PermissionSeed = {
  name: string;
  category: string;
  description: string;
};

type RoleSeed = {
  name: string;
  displayName: string;
  description: string;
  isPublic?: boolean;
  permissions: string[];
};

const permissions: PermissionSeed[] = [
  {
    name: "profile:read:self",
    category: "user",
    description: "Xem hồ sơ của chính mình",
  },
  {
    name: "profile:update:self",
    category: "user",
    description: "Cập nhật hồ sơ của chính mình",
  },
  {
    name: "cart:manage:self",
    category: "cart",
    description: "Quản lý giỏ hàng của chính mình",
  },
  {
    name: "wishlist:manage:self",
    category: "wishlist",
    description: "Quản lý danh sách yêu thích của chính mình",
  },
  {
    name: "seller:apply:self",
    category: "seller",
    description: "Đăng ký mở shop",
  },
  {
    name: "seller:read:self",
    category: "seller",
    description: "Xem hồ sơ seller của chính mình",
  },
  {
    name: "product:create:self",
    category: "product",
    description: "Tạo sản phẩm thuộc shop của mình",
  },
  {
    name: "product:update:self",
    category: "product",
    description: "Cập nhật sản phẩm thuộc shop của mình",
  },
  {
    name: "product:publish:self",
    category: "product",
    description: "Đưa sản phẩm của shop mình lên bán",
  },
  {
    name: "product:archive:self",
    category: "product",
    description: "Ẩn hoặc ngưng bán sản phẩm của shop mình",
  },
  {
    name: "admin:seller:list",
    category: "admin",
    description: "Xem danh sách seller trong admin",
  },
  {
    name: "admin:seller:approve",
    category: "admin",
    description: "Duyệt seller pending",
  },
  {
    name: "admin:seller:suspend",
    category: "admin",
    description: "Tạm khóa seller",
  },
  {
    name: "admin:seller:ban",
    category: "admin",
    description: "Khóa vĩnh viễn seller",
  },
  {
    name: "admin:analytics:read",
    category: "admin",
    description: "Xem dữ liệu phân tích và dashboard",
  },
  {
    name: "admin:system:full",
    category: "admin",
    description: "Toàn quyền trong user-service",
  },
];

const roles: RoleSeed[] = [
  {
    name: "BUYER",
    displayName: "Buyer",
    description: "Người dùng mua hàng thông thường",
    isPublic: true,
    permissions: [
      "profile:read:self",
      "profile:update:self",
      "cart:manage:self",
      "wishlist:manage:self",
      "seller:apply:self",
      "seller:read:self",
    ],
  },
  {
    name: "SELLER",
    displayName: "Seller",
    description: "Người bán hàng trên sàn",
    isPublic: true,
    permissions: [
      "profile:read:self",
      "profile:update:self",
      "cart:manage:self",
      "wishlist:manage:self",
      "seller:apply:self",
      "seller:read:self",
      "product:create:self",
      "product:update:self",
      "product:publish:self",
      "product:archive:self",
    ],
  },
  {
    name: "ADMIN_MODERATOR",
    displayName: "Admin Moderator",
    description: "Admin chuyên duyệt seller và xử lý moderation",
    isPublic: false,
    permissions: [
      "admin:seller:list",
      "admin:seller:approve",
      "admin:seller:suspend",
      "admin:seller:ban",
    ],
  },
  {
    name: "ADMIN_OPERATIONS",
    displayName: "Admin Operations",
    description: "Admin vận hành, xử lý sự cố seller",
    isPublic: false,
    permissions: [
      "admin:seller:list",
      "admin:seller:suspend",
      "admin:seller:ban",
    ],
  },
  {
    name: "ADMIN_ANALYTICS",
    displayName: "Admin Analytics",
    description: "Admin chỉ đọc dữ liệu và theo dõi hoạt động",
    isPublic: false,
    permissions: ["admin:seller:list", "admin:analytics:read"],
  },
  {
    name: "SUPER_ADMIN",
    displayName: "Super Admin",
    description: "Toàn quyền quản trị trong user-service",
    isPublic: false,
    permissions: permissions.map((permission) => permission.name),
  },
];

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        category: permission.category,
        description: permission.description,
      },
      create: permission,
    });
  }

  for (const role of roles) {
    const savedRole = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        displayName: role.displayName,
        description: role.description,
        isPublic: role.isPublic ?? true,
      },
      create: {
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isPublic: role.isPublic ?? true,
      },
    });

    const savedPermissions = await prisma.permission.findMany({
      where: { name: { in: role.permissions } },
      select: { id: true, name: true },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: savedRole.id },
    });

    if (savedPermissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: savedPermissions.map((permission) => ({
          roleId: savedRole.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  console.log(
    `[seed] Seeded ${roles.length} roles and ${permissions.length} permissions`,
  );
}

main()
  .catch((error) => {
    console.error("[seed] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
