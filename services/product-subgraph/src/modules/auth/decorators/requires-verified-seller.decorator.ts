import { SetMetadata } from '@nestjs/common';

export const RequiresVerifiedSeller = () => SetMetadata('requiresVerifiedSeller', true);
