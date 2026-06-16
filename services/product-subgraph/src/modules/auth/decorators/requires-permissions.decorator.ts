import { SetMetadata } from '@nestjs/common';

/**
 * @RequiresPermissions decorator sets metadata for PermissionGuard
 * Example: @RequiresPermissions('products:write', 'products:admin')
 */
export const RequiresPermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
