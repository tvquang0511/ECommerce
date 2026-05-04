import { prisma } from '../src/db/prisma.js';

type PermissionSeed = {
  name: string;
  description: string;
  category: string;
};

type RoleSeed = {
  name: string;
  displayName: string;
  description: string;
  isPublic: boolean;
  permissions: string[];
};

const permissions: PermissionSeed[] = [
  { name: 'product:view_approved', description: 'View approved products', category: 'product' },
  { name: 'product:search', description: 'Search product catalog', category: 'product' },
  { name: 'product:view_detail', description: 'View product detail', category: 'product' },
  { name: 'product:create', description: 'Create product draft', category: 'product' },
  { name: 'product:edit_own', description: 'Edit own product', category: 'product' },
  { name: 'product:delete_own_draft', description: 'Delete own draft product', category: 'product' },
  { name: 'product:submit_for_approval', description: 'Submit product for approval', category: 'product' },
  { name: 'product:upload_images', description: 'Upload product images', category: 'product' },
  { name: 'product:view_all', description: 'View all products', category: 'product' },
  { name: 'product:approve', description: 'Approve or reject products', category: 'product' },
  { name: 'seller:verify', description: 'Verify seller account', category: 'seller' },
  { name: 'seller:suspend', description: 'Suspend seller account', category: 'seller' },
  { name: 'seller:view_all', description: 'View all sellers', category: 'seller' },
  { name: 'analytics:view_all', description: 'View all analytics dashboards', category: 'admin' },
  { name: 'analytics:view_own', description: 'View own analytics dashboard', category: 'analytics' },
  { name: 'cart:manage', description: 'Manage cart items', category: 'cart' },
  { name: 'wishlist:manage', description: 'Manage wishlist', category: 'wishlist' },
];

const roles: RoleSeed[] = [
  {
    name: 'BUYER',
    displayName: 'Buyer',
    description: 'Default customer role',
    isPublic: true,
    permissions: ['product:view_approved', 'product:search', 'product:view_detail', 'cart:manage', 'wishlist:manage'],
  },
  {
    name: 'SELLER',
    displayName: 'Seller',
    description: 'Marketplace seller role',
    isPublic: true,
    permissions: ['product:create', 'product:edit_own', 'product:delete_own_draft', 'product:submit_for_approval', 'product:upload_images', 'analytics:view_own'],
  },
  {
    name: 'ADMIN_MODERATOR',
    displayName: 'Admin Moderator',
    description: 'Moderates products and sellers',
    isPublic: false,
    permissions: ['product:view_all', 'product:approve', 'seller:verify', 'seller:suspend', 'seller:view_all'],
  },
  {
    name: 'ADMIN_OPERATIONS',
    displayName: 'Admin Operations',
    description: 'Operations role for admin tasks',
    isPublic: false,
    permissions: ['product:view_all', 'seller:view_all', 'seller:suspend'],
  },
  {
    name: 'ADMIN_ANALYTICS',
    displayName: 'Admin Analytics',
    description: 'Analytics and reporting role',
    isPublic: false,
    permissions: ['analytics:view_all', 'seller:view_all', 'product:view_all'],
  },
  {
    name: 'SUPER_ADMIN',
    displayName: 'Super Admin',
    description: 'Full platform control',
    isPublic: false,
    permissions: permissions.map((permission) => permission.name),
  },
];

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        description: permission.description,
        category: permission.category,
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
        isPublic: role.isPublic,
      },
      create: {
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        isPublic: role.isPublic,
      },
    });

    const rolePermissions = role.permissions.map(async (permissionName) => {
      const permission = await prisma.permission.findUnique({ where: { name: permissionName } });
      if (!permission) {
        throw new Error(`Missing permission seed: ${permissionName}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: savedRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: savedRole.id,
          permissionId: permission.id,
        },
      });
    });

    await Promise.all(rolePermissions);
  }

  console.log('RBAC seed completed successfully');
}

main()
  .catch((error) => {
    console.error('RBAC seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });