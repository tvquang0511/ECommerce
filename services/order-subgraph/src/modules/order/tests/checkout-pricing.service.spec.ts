import { CheckoutPricingService } from '../application/services/checkout-pricing.service';
import { BuyerCartSnapshot, CartReaderService } from '../infrastructure/integrations/cart-reader.service';
import {
  ProductCheckoutSnapshot,
  ProductReaderService,
} from '../infrastructure/integrations/product-reader.service';

describe('CheckoutPricingService', () => {
  let cartReader: jest.Mocked<CartReaderService>;
  let productReader: jest.Mocked<ProductReaderService>;
  let service: CheckoutPricingService;

  beforeEach(() => {
    cartReader = {
      readBuyerCart: jest.fn(),
    } as unknown as jest.Mocked<CartReaderService>;

    productReader = {
      revalidateProducts: jest.fn(),
      previewDirectOrder: jest.fn(),
    } as unknown as jest.Mocked<ProductReaderService>;

    service = new CheckoutPricingService(cartReader, productReader);
  });

  it('re-prices cart items using live product data', async () => {
    const cart: BuyerCartSnapshot = {
      cartId: 'cart-1',
      buyerId: 'buyer-1',
      currency: 'VND',
      items: [
        {
          itemId: 'ci-1',
          productId: 'p1003',
          quantity: 2,
          titleSnapshot: 'Old title',
          imageSnapshot: 'old-image.jpg',
          unitPriceAmount: 9900000,
          currency: 'VND',
        },
      ],
    };

    const liveProducts: ProductCheckoutSnapshot[] = [
      {
        productId: 'p1003',
        sellerId: 'seller-1',
        titleSnapshot: 'Dell UltraSharp 27 4K',
        imageSnapshot: 'products/p1003/cover.jpg',
        unitPriceAmount: 11290000,
        currency: 'VND',
      },
    ];

    cartReader.readBuyerCart.mockResolvedValue(cart);
    productReader.revalidateProducts.mockResolvedValue(liveProducts);

    const result = await service.previewFromCart('buyer-1', 'token-123', 'cart-1');

    expect(cartReader.readBuyerCart).toHaveBeenCalledWith('buyer-1', 'token-123', 'cart-1');
    expect(productReader.revalidateProducts).toHaveBeenCalledWith(['p1003']);
    expect(result.cartId).toBe('cart-1');
    expect(result.sellerIds).toEqual(['seller-1']);
    expect(result.totalAmount).toBe(22580000);
    expect(result.currency).toBe('VND');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].titleSnapshot).toBe('Dell UltraSharp 27 4K');
    expect(result.items[0].unitPriceAmount).toBe(11290000);
  });

  it('builds direct order preview from a single live product', async () => {
    productReader.previewDirectOrder.mockResolvedValue({
      productId: 'p1006',
      sellerId: 'seller-2',
      titleSnapshot: 'Webcam Full HD',
      imageSnapshot: 'products/p1006/cover.jpg',
      unitPriceAmount: 1290000,
      currency: 'VND',
      quantity: 3,
    });

    const result = await service.previewDirect('p1006', 3);

    expect(productReader.previewDirectOrder).toHaveBeenCalledWith('p1006', 3);
    expect(result.sellerIds).toEqual(['seller-2']);
    expect(result.totalAmount).toBe(3870000);
    expect(result.currency).toBe('VND');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(3);
  });

  it('fails when live product snapshots are missing for a cart item', async () => {
    cartReader.readBuyerCart.mockResolvedValue({
      cartId: 'cart-2',
      buyerId: 'buyer-2',
      currency: 'VND',
      items: [
        {
          itemId: 'ci-2',
          productId: 'p404',
          quantity: 1,
          titleSnapshot: 'Ghost item',
          imageSnapshot: null,
          unitPriceAmount: 1,
          currency: 'VND',
        },
      ],
    });
    productReader.revalidateProducts.mockResolvedValue([]);

    await expect(service.previewFromCart('buyer-2')).rejects.toThrow(
      'Missing product snapshot for p404',
    );
  });

  it('fails when mixed currencies are returned from live product data', async () => {
    cartReader.readBuyerCart.mockResolvedValue({
      cartId: 'cart-3',
      buyerId: 'buyer-3',
      currency: 'VND',
      items: [
        {
          itemId: 'ci-3',
          productId: 'p1001',
          quantity: 1,
          titleSnapshot: 'Item A',
          imageSnapshot: null,
          unitPriceAmount: 100,
          currency: 'VND',
        },
        {
          itemId: 'ci-4',
          productId: 'p1002',
          quantity: 1,
          titleSnapshot: 'Item B',
          imageSnapshot: null,
          unitPriceAmount: 200,
          currency: 'USD',
        },
      ],
    });
    productReader.revalidateProducts.mockResolvedValue([
      {
        productId: 'p1001',
        sellerId: 'seller-a',
        titleSnapshot: 'Item A live',
        imageSnapshot: null,
        unitPriceAmount: 100,
        currency: 'VND',
      },
      {
        productId: 'p1002',
        sellerId: 'seller-b',
        titleSnapshot: 'Item B live',
        imageSnapshot: null,
        unitPriceAmount: 200,
        currency: 'USD',
      },
    ]);

    await expect(service.previewFromCart('buyer-3')).rejects.toThrow(
      'Mixed currencies are not supported yet',
    );
  });
});
