import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthContextService } from '../auth/auth-context.service';
import { ProductsResolver } from './products.resolver';
import { ProductsService } from './products.service';

describe('ProductsResolver', () => {
  let controller: ProductsResolver;

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

  const authContextServiceMock = {
    getOptionalActor: jest.fn(),
    getRequiredActor: jest.fn(),
    ensureVerifiedSeller: jest.fn(),
    ensureAdmin: jest.fn(),
  };

  const mockReq = {
    header: () => undefined,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsResolver],
      providers: [
        {
          provide: ProductsService,
          useValue: productsServiceMock,
        },
        {
          provide: AuthContextService,
          useValue: authContextServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ProductsResolver>(ProductsResolver);
  });

  it('returns all products', async () => {
    const mockProducts = [{ id: 'p1', name: 'Keyboard', price: 49.9 }];
    authContextServiceMock.getOptionalActor.mockResolvedValue(null);
    productsServiceMock.findAll.mockResolvedValue(mockProducts);

    await expect(controller.findAll(mockReq)).resolves.toEqual(mockProducts);
  });

  it('returns product by id', async () => {
    const mockProduct = { id: 'p1', name: 'Keyboard', price: 49.9 };
    authContextServiceMock.getOptionalActor.mockResolvedValue(null);
    productsServiceMock.findById.mockResolvedValue(mockProduct);

    await expect(controller.findById('p1', mockReq)).resolves.toEqual(mockProduct);
  });

  it('throws NotFoundException when product id is missing', async () => {
    authContextServiceMock.getOptionalActor.mockResolvedValue(null);
    productsServiceMock.findById.mockResolvedValue(undefined);

    await expect(controller.findById('missing', mockReq)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates product', async () => {
    const actor = { userId: 'seller-1', roles: ['SELLER'] };
    const input = { name: 'Desk', price: 120 };
    const created = { id: 'p4', sellerId: 'seller-1', ...input };
    authContextServiceMock.getRequiredActor.mockResolvedValue(actor);
    productsServiceMock.create.mockResolvedValue(created);

    await expect(controller.create(input, mockReq)).resolves.toEqual(created);
  });

  it('updates product', async () => {
    const input = { price: 22.5 };
    const actor = { userId: 'seller-1', roles: ['SELLER'] };
    const updated = { id: 'p2', name: 'Mouse', price: 22.5 };
    authContextServiceMock.getRequiredActor.mockResolvedValue(actor);
    productsServiceMock.update.mockResolvedValue(updated);

    await expect(controller.update('p2', input, mockReq)).resolves.toEqual(updated);
  });

  it('throws NotFoundException when update target does not exist', async () => {
    authContextServiceMock.getRequiredActor.mockResolvedValue({
      userId: 'seller-1',
      roles: ['SELLER'],
    });
    productsServiceMock.update.mockResolvedValue(undefined);

    await expect(
      controller.update('missing', { name: 'X' }, mockReq),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes product and returns true', async () => {
    authContextServiceMock.getRequiredActor.mockResolvedValue({
      userId: 'seller-1',
      roles: ['SELLER'],
    });
    productsServiceMock.remove.mockResolvedValue(true);

    await expect(controller.remove('p1', mockReq)).resolves.toBe(true);
  });

  it('throws NotFoundException when deleting missing product', async () => {
    authContextServiceMock.getRequiredActor.mockResolvedValue({
      userId: 'seller-1',
      roles: ['SELLER'],
    });
    productsServiceMock.remove.mockResolvedValue(false);

    await expect(controller.remove('missing', mockReq)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('submits product for review', async () => {
    const actor = { userId: 'seller-1', roles: ['SELLER'] };
    const submitted = { id: 'p1', status: 'PENDING_REVIEW' };
    authContextServiceMock.getRequiredActor.mockResolvedValue(actor);
    productsServiceMock.submitForReview.mockResolvedValue(submitted);

    await expect(controller.submitForReview('p1', mockReq)).resolves.toEqual(
      submitted,
    );
  });

  it('approves product as admin', async () => {
    const actor = { userId: 'admin-1', roles: ['ADMIN_MODERATOR'] };
    const approved = { id: 'p1', status: 'APPROVED' };
    authContextServiceMock.getRequiredActor.mockResolvedValue(actor);
    productsServiceMock.approve.mockResolvedValue(approved);

    await expect(controller.approve('p1', mockReq)).resolves.toEqual(approved);
  });
});
