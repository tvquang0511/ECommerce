import { registerEnumType } from '@nestjs/graphql';

export enum ProductMediaKind {
  COVER = 'COVER',
  GALLERY = 'GALLERY',
}

registerEnumType(ProductMediaKind, {
  name: 'ProductMediaKind',
});
