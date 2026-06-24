import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RemoveCartItemResponse = {
  data?: {
    removeCartItem?: {
      id: string;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

@Injectable()
export class CartWriterService {
  constructor(private readonly configService: ConfigService) {}

  async removeSelectedItems(
    buyerId: string,
    selectedItemIds: string[],
    accessToken?: string,
  ): Promise<void> {
    if (selectedItemIds.length === 0) {
      return;
    }

    for (const itemId of selectedItemIds) {
      await this.removeCartItem(buyerId, itemId, accessToken);
    }
  }

  private async removeCartItem(
    buyerId: string,
    itemId: string,
    accessToken?: string,
  ): Promise<void> {
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
            'mutation RemoveCartItem($input: RemoveCartItemInput!) { removeCartItem(input: $input) { id } }',
          variables: {
            input: {
              itemId,
            },
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        throw new ServiceUnavailableException('Cart-subgraph remove-item request timed out');
      }

      throw new BadGatewayException('Cannot reach cart-subgraph for item removal');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException('Cannot remove selected items from cart');
      }

      throw new BadGatewayException('Cart-subgraph error while removing selected items');
    }

    let payload: RemoveCartItemResponse;
    try {
      payload = (await response.json()) as RemoveCartItemResponse;
    } catch {
      throw new BadGatewayException('Invalid response from cart-subgraph');
    }

    if (payload.errors?.length) {
      const message = payload.errors[0]?.message ?? 'Cart-subgraph GraphQL error';
      throw new BadGatewayException(message);
    }
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
