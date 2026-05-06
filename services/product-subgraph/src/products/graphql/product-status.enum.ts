import { registerEnumType } from '@nestjs/graphql';

export enum ProductStatusEnum {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}

registerEnumType(ProductStatusEnum, {
  name: 'ProductStatusEnum',
});
