import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ProductSnapshot = {
  productId: string;
  titleSnapshot: string;
  imageSnapshot: string | null;
  unitPriceAmount: number;
  currency: string;
};

type ProductQueryResponse = {
  data?: {
    product?: {
      id: string;
      name: string;
      price: number;
      currency: string;
      status: string;
      coverImage?: { objectKey?: string | null } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>; // graphql errors
};

@Injectable()
export class ProductCatalogService {
  constructor(private readonly configService: ConfigService) {}

  async getApprovedProductSnapshot(productId: string): Promise<ProductSnapshot> {
    const baseUrl =
      this.configService.get<string>('cart.productSubgraphBaseUrl') ??
      'http://localhost:4002';
    const requestTimeoutMs =
      this.configService.get<number>('cart.productRequestTimeoutMs') ?? 5000;

    const url = `${baseUrl.replace(/\/+$/g, '')}/graphql`;

    const query =
      'query Product($id: String!) { product(id: $id) { id name price currency status coverImage { objectKey } } }';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { id: productId },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        throw new BadGatewayException('Product-subgraph request timed out');
      }

      throw new BadGatewayException('Cannot reach product-subgraph');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new BadGatewayException('Product-subgraph error');
    }

    let payload: ProductQueryResponse;
    try {
      payload = (await response.json()) as ProductQueryResponse;
    } catch {
      throw new BadGatewayException('Invalid response from product-subgraph');
    }

    if (payload.errors?.length) {
      const msg = payload.errors[0]?.message ?? 'Product-subgraph GraphQL error';
      throw new BadRequestException(msg);
    }

    const product = payload.data?.product;
    if (!product) {
      throw new BadRequestException(`Product ${productId} not found`);
    }

    if (product.status !== 'APPROVED') {
      throw new BadRequestException(
        `Product ${productId} is not APPROVED (status=${product.status})`,
      );
    }

    return {
      productId: product.id,
      titleSnapshot: product.name,
      imageSnapshot: product.coverImage?.objectKey ?? null,
      unitPriceAmount: product.price,
      currency: product.currency,
    };
  }
}
