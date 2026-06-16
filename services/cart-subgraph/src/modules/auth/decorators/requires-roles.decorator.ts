import { SetMetadata } from '@nestjs/common';

export const RequiresRoles = (...roles: string[]) => SetMetadata('roles', roles);
