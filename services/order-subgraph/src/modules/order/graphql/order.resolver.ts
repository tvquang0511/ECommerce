import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../auth/guards/auth.guard';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';
import { AuthActor } from '../../auth/auth.types';
import { Order, OrderCommandResult } from './order.gql.type';
import {
  CancelOrderInput,
  CreateOrderDirectInput,
  CreateOrderFromCartInput,
  SubmitOrderInput,
} from './order.input';
import { CreateOrderDirectCommand } from '../application/commands/create-order-direct/create-order-direct.command';
import { CreateOrderFromCartCommand } from '../application/commands/create-order-from-cart/create-order-from-cart.command';
import { SubmitOrderCommand } from '../application/commands/submit-order/submit-order.command';
import { CancelOrderCommand } from '../application/commands/cancel-order/cancel-order.command';
import { GetOrderQuery } from '../application/queries/get-order/get-order.query';
import { ListMyOrdersQuery } from '../application/queries/list-my-orders/list-my-orders.query';

@Resolver(() => Order)
export class OrderResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Query(() => [Order], { name: 'orders' })
  async orders(): Promise<Order[]> {
    return [];
  }

  @Query(() => [Order], { name: 'myOrders' })
  @UseGuards(AuthGuard)
  async myOrders(@CurrentActor() actor: AuthActor): Promise<Order[]> {
    return this.queryBus.execute(new ListMyOrdersQuery(actor.userId));
  }

  @Query(() => Order, { name: 'order', nullable: true })
  @UseGuards(AuthGuard)
  async order(
    @Args('id', { type: () => ID }) id: string,
    @CurrentActor() actor: AuthActor,
  ): Promise<Order | null> {
    const order = await this.queryBus.execute(new GetOrderQuery(id, actor.userId));
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  @Mutation(() => OrderCommandResult, { name: 'createOrderFromCart' })
  @UseGuards(AuthGuard)
  async createOrderFromCart(
    @Args('input') input: CreateOrderFromCartInput,
    @CurrentActor() actor: AuthActor,
    @Context('req') req: { headers?: Record<string, string | string[] | undefined> },
  ): Promise<OrderCommandResult> {
    return this.commandBus.execute(
      new CreateOrderFromCartCommand(
        actor.userId,
        input.cartId,
        input.selectedItemIds,
        input.idempotencyKey,
        this.extractBearerToken(req),
      ),
    );
  }

  @Mutation(() => OrderCommandResult, { name: 'createOrderDirect' })
  @UseGuards(AuthGuard)
  async createOrderDirect(
    @Args('input') input: CreateOrderDirectInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<OrderCommandResult> {
    return this.commandBus.execute(
      new CreateOrderDirectCommand(
        actor.userId,
        input.productId,
        input.quantity,
        input.idempotencyKey,
      ),
    );
  }

  @Mutation(() => OrderCommandResult, { name: 'submitOrder' })
  @UseGuards(AuthGuard)
  async submitOrder(
    @Args('input') input: SubmitOrderInput,
    @CurrentActor() actor: AuthActor,
    @Context('req') req: { headers?: Record<string, string | string[] | undefined> },
  ): Promise<OrderCommandResult> {
    return this.commandBus.execute(
      new SubmitOrderCommand(
        input.orderId,
        actor.userId,
        input.expectedVersion,
        input.idempotencyKey,
        this.extractBearerToken(req),
      ),
    );
  }

  @Mutation(() => OrderCommandResult, { name: 'cancelOrder' })
  @UseGuards(AuthGuard)
  async cancelOrder(
    @Args('input') input: CancelOrderInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<OrderCommandResult> {
    return this.commandBus.execute(
      new CancelOrderCommand(
        input.orderId,
        actor.userId,
        input.expectedVersion,
        input.idempotencyKey,
        input.reason,
      ),
    );
  }

  private extractBearerToken(req: {
    headers?: Record<string, string | string[] | undefined>;
  }): string | undefined {
    const authorization = req.headers?.authorization;
    const headerValue = Array.isArray(authorization) ? authorization[0] : authorization;
    if (!headerValue) {
      return undefined;
    }

    const match = /^Bearer\s+(.+)$/.exec(headerValue.trim());
    return match?.[1]?.trim() || undefined;
  }
}
