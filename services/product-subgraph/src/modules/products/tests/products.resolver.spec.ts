import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ProductsResolver } from '../graphql/products.resolver';
import { ProductsService } from '../application/products.service';

describe('ProductsResolver', () => {
  let resolver: ProductsResolver;

  const productsServiceMock = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    submitForReview: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    archive: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsResolver,
        {
          provide: ProductsService,
          useValue: productsServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<ProductsResolver>(ProductsResolver);
  });

  it('returns all products', async () => {
    const mockProducts = [{ id: 'p1', name: 'Keyboard', price: 49.9 }];
    productsServiceMock.findAll.mockResolvedValue(mockProducts);

    await expect(resolver.findAll(null)).resolves.toEqual(mockProducts);
  });

  it('returns product by id', async () => {
    const mockProduct = { id: 'p1', name: 'Keyboard', price: 49.9 };
    productsServiceMock.findById.mockResolvedValue(mockProduct);

    await expect(resolver.findById('p1', null)).resolves.toEqual(mockProduct);
  });

  it('throws NotFoundException when product id is missing', async () => {
    productsServiceMock.findById.mockResolvedValue(undefined);

    await expect(resolver.findById('missing', null)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates product', async () => {
    const actor = {
      userId: 'seller-1',
      roles: ['SELLER'],
      permissions: ['product:create:self'],
      sellerProfile: { status: 'VERIFIED', isKycVerified: true },
    };
    const input = { name: 'Desk', price: 120, sku: 'DESK-001' };
    const created = { id: 'p4', sellerId: 'seller-1', ...input };
    productsServiceMock.create.mockResolvedValue(created);

    await expect(resolver.create(input as any, actor as any)).resolves.toEqual(created);
  });

  it('updates product', async () => {
    const input = { price: 22.5 };
    const actor = {
      userId: 'seller-1',
      roles: ['SELLER'],
      permissions: ['product:update:self'],
      sellerProfile: { status: 'VERIFIED', isKycVerified: true },
    };
    const updated = { id: 'p2', name: 'Mouse', price: 22.5 };
    productsServiceMock.update.mockResolvedValue(updated);

    await expect(resolver.update('p2', input as any, actor as any)).resolves.toEqual(updated);
  });

  it('throws NotFoundException when update target does not exist', async () => {
    const actor = {
      userId: 'seller-1',
      roles: ['SELLER'],
      permissions: ['product:update:self'],
      sellerProfile: { status: 'VERIFIED', isKycVerified: true },
    };
    productsServiceMock.update.mockResolvedValue(undefined);

    await expect(
      resolver.update('missing', { name: 'X' } as any, actor as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes product and returns true', async () => {
    const actor = {
      userId: 'seller-1',
      roles: ['SELLER'],
      permissions: ['product:archive:self'],
      sellerProfile: { status: 'VERIFIED', isKycVerified: true },
    };
    productsServiceMock.remove.mockResolvedValue(true);

    await expect(resolver.remove('p1', actor as any)).resolves.toBe(true);
  });

  it('throws NotFoundException when deleting missing product', async () => {
    const actor = {
      userId: 'seller-1',
      roles: ['SELLER'],
      permissions: ['product:archive:self'],
      sellerProfile: { status: 'VERIFIED', isKycVerified: true },
    };
    productsServiceMock.remove.mockResolvedValue(false);

    await expect(resolver.remove('missing', actor as any)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('submits product for review', async () => {
    const actor = {
      userId: 'seller-1',
      roles: ['SELLER'],
      permissions: ['product:publish:self'],
      sellerProfile: { status: 'VERIFIED', isKycVerified: true },
    };
    const submitted = { id: 'p1', status: 'PENDING_REVIEW' };
    productsServiceMock.submitForReview.mockResolvedValue(submitted);

    await expect(resolver.submitForReview('p1', actor as any)).resolves.toEqual(
      submitted,
    );
  });

  it('approves product as admin', async () => {
    const approved = { id: 'p1', status: 'APPROVED' };
    productsServiceMock.approve.mockResolvedValue(approved);

    await expect(resolver.approve('p1')).resolves.toEqual(approved);
  });
});
