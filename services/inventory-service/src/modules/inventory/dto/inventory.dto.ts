import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReserveInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  sellerId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class ReserveInventoryRequestDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsOptional()
  buyerId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderVersion?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReserveInventoryItemDto)
  items!: ReserveInventoryItemDto[];
}

export class ReleaseInventoryRequestDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}

export class CheckInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CheckInventoryRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckInventoryItemDto)
  items!: CheckInventoryItemDto[];
}

export class UpsertStockItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(0)
  available!: number;
}

export class UpsertStockRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertStockItemDto)
  items!: UpsertStockItemDto[];
}
