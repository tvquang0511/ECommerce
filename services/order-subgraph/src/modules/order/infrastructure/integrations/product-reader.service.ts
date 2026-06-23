import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProductCheckoutSnapshot {
  productId: string;
  sellerId: string;
  titleSnapshot: string;
  imageSnapshot?: string | null;
  unitPriceAmount: number;
  currency: string;
}

export interface DirectProductPreview extends ProductCheckoutSnapshot {
  quantity: number;
}

type ProductQueryResponse = {
  data?: {
    product?: {
      id: string;
      sellerId: string;
      name: string;
      price: number;
      salePrice?: number | null;
      currency: string;
      status: string;
      coverImage?: {
        objectKey?: string | null;
      } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

@Injectable()
export class ProductReaderService {
  constructor(private readonly configService: ConfigService) {}

  async revalidateProducts(productIds: string[]): Promise<ProductCheckoutSnapshot[]> {
    return Promise.all(productIds.map((productId) => this.readApprovedProduct(productId)));
  }

  async previewDirectOrder(productId: string, quantity: number): Promise<DirectProductPreview> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const product = await this.readApprovedProduct(productId);

    return {
      quantity,
      ...product,
    };
  }

  private async readApprovedProduct(productId: string): Promise<ProductCheckoutSnapshot> {
    const baseUrl =
      this.configService.get<string>('order.productSubgraphBaseUrl') ??
      'http://localhost:4002';
    const requestTimeoutMs = 5000;
    const url = `${baseUrl.replace(/\/+$/g, '')}/graphql`;

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
          query:
            'query Product($id: ID!) { product(id: $id) { id sellerId name price salePrice currency status coverImage { objectKey } } }',
          variables: { id: productId },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as { name?: string }).name === 'AbortError') {
        throw new ServiceUnavailableException('Product-subgraph request timed out');
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
      const message = payload.errors[0]?.message ?? 'Product-subgraph GraphQL error';
      throw new BadRequestException(message);
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

    const effectivePrice =
      typeof product.salePrice === 'number' && Number.isFinite(product.salePrice)
        ? product.salePrice
        : product.price;

    return {
      productId: product.id,
      sellerId: product.sellerId,
      titleSnapshot: product.name,
      imageSnapshot: product.coverImage?.objectKey ?? null,
      unitPriceAmount: effectivePrice,
      currency: product.currency,
    };
  }
}
