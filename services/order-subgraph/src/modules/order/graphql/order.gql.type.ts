import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

import { OrderInventoryStatusEnum } from '../domain/enums/order-inventory-status.enum';
import { OrderPaymentStatusEnum } from '../domain/enums/order-payment-status.enum';
import { OrderStatusEnum } from '../domain/enums/order-status.enum';

registerEnumType(OrderStatusEnum, {
  name: 'OrderStatus',
});

registerEnumType(OrderInventoryStatusEnum, {
  name: 'OrderInventoryStatus',
});

registerEnumType(OrderPaymentStatusEnum, {
  name: 'OrderPaymentStatus',
});

@ObjectType()
export class Money {
  @Field(() => Int)
  amount!: number;

  @Field()
  currency!: string;
}

@ObjectType()
export class OrderItem {
  @Field(() => ID)
  lineId!: string;

  @Field()
  productId!: string;

  @Field()
  sellerId!: string;

  @Field()
  titleSnapshot!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Money)
  unitPrice!: Money;
}

@ObjectType()
export class Order {
  @Field(() => ID)
  id!: string;

  @Field()
  buyerId!: string;

  @Field(() => [String])
  sellerIds!: string[];

  @Field(() => OrderStatusEnum)
  status!: OrderStatusEnum;

  @Field(() => OrderInventoryStatusEnum)
  inventoryStatus!: OrderInventoryStatusEnum;

  @Field(() => OrderPaymentStatusEnum)
  paymentStatus!: OrderPaymentStatusEnum;

  @Field(() => Money)
  total!: Money;

  @Field(() => Int)
  version!: number;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;

  @Field(() => [OrderItem])
  items!: OrderItem[];
}

@ObjectType()
export class OrderCommandResult {
  @Field(() => ID)
  orderId!: string;

  @Field(() => OrderStatusEnum)
  status!: OrderStatusEnum;

  @Field(() => Int)
  version!: number;

  @Field()
  correlationId!: string;

  @Field()
  message!: string;
}

export { OrderStatusEnum as OrderStatus };
export { OrderInventoryStatusEnum as OrderInventoryStatus };
export { OrderPaymentStatusEnum as OrderPaymentStatus };
