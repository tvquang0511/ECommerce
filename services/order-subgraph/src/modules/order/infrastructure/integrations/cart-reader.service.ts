import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CartSnapshotItem {
  itemId: string;
  productId: string;
  quantity: number;
  titleSnapshot: string;
  imageSnapshot?: string | null;
  unitPriceAmount: number;
  currency: string;
}

export interface BuyerCartSnapshot {
  cartId: string;
  buyerId: string;
  currency: string;
  items: CartSnapshotItem[];
}

type CartQueryResponse = {
  data?: {
    cart?: {
      id: string;
      userId: string;
      currency: string;
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        titleSnapshot: string;
        imageSnapshot?: string | null;
        unitPrice: {
          amount: number;
          currency: string;
        };
      }>;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

@Injectable()
export class CartReaderService {
  constructor(private readonly configService: ConfigService) {}

  async readBuyerCart(
    buyerId: string,
    accessToken?: string,
    cartId?: string,
  ): Promise<BuyerCartSnapshot> {
    void cartId;

    const baseUrl =
      this.configService.get<string>('order.cartSubgraphBaseUrl') ??
      'http://localhost:4003';
    const requestTimeoutMs = 5000;
    const url = `${baseUrl.replace(/\/+$/g, '')}/graphql`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(buyerId, accessToken),
        body: JSON.stringify({
          query:
            'query Cart { cart { id userId currency items { id productId quantity titleSnapshot imageSnapshot unitPrice { amount currency } } } }',
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        throw new ServiceUnavailableException('Cart-subgraph request timed out');
      }

      throw new BadGatewayException('Cannot reach cart-subgraph');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException('Cannot read buyer cart');
      }

      throw new BadGatewayException('Cart-subgraph error');
    }

    let payload: CartQueryResponse;
    try {
      payload = (await response.json()) as CartQueryResponse;
    } catch {
      throw new BadGatewayException('Invalid response from cart-subgraph');
    }

    if (payload.errors?.length) {
      const message = payload.errors[0]?.message ?? 'Cart-subgraph GraphQL error';
      throw new BadGatewayException(message);
    }

    const cart = payload.data?.cart;
    if (!cart) {
      return {
        cartId: cartId ?? '',
        buyerId,
        currency: this.configService.get<string>('order.defaultCurrency') ?? 'VND',
        items: [],
      };
    }

    if (cart.userId !== buyerId) {
      throw new UnauthorizedException('Cart does not belong to the current buyer');
    }

    return {
      cartId: cart.id,
      buyerId: cart.userId,
      currency: cart.currency,
      items: cart.items.map((item) => ({
        itemId: item.id,
        productId: item.productId,
        quantity: item.quantity,
        titleSnapshot: item.titleSnapshot,
        imageSnapshot: item.imageSnapshot ?? null,
        unitPriceAmount: item.unitPrice.amount,
        currency: item.unitPrice.currency,
      })),
    };
  }

  private buildHeaders(
    buyerId: string,
    accessToken?: string,
  ): Record<string, string> {
    if (accessToken) {
      return {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      };
    }

    return {
      'content-type': 'application/json',
      'x-dev-user-id': buyerId,
    };
  }
}
