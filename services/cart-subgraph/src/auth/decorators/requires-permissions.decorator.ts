import { SetMetadata } from '@nestjs/common';

export const RequiresPermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
