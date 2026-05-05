import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;

  const productsServiceMock = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: productsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('returns all products', async () => {
    const mockProducts = [{ id: 'p1', name: 'Keyboard', price: 49.9 }];
    productsServiceMock.findAll.mockResolvedValue(mockProducts);

    await expect(controller.findAll()).resolves.toEqual(mockProducts);
  });

  it('returns product by id', async () => {
    const mockProduct = { id: 'p1', name: 'Keyboard', price: 49.9 };
    productsServiceMock.findById.mockResolvedValue(mockProduct);

    await expect(controller.findById('p1')).resolves.toEqual(mockProduct);
  });

  it('throws NotFoundException when product id is missing', async () => {
    productsServiceMock.findById.mockResolvedValue(undefined);

    await expect(controller.findById('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('creates product', async () => {
    const input = { sellerId: 'seller-1', name: 'Desk', price: 120 };
    const created = { id: 'p4', ...input };
    productsServiceMock.create.mockResolvedValue(created);

    await expect(controller.create(input)).resolves.toEqual(created);
  });

  it('updates product', async () => {
    const input = { price: 22.5 };
    const updated = { id: 'p2', name: 'Mouse', price: 22.5 };
    productsServiceMock.update.mockResolvedValue(updated);

    await expect(controller.update('p2', input)).resolves.toEqual(updated);
  });

  it('throws NotFoundException when update target does not exist', async () => {
    productsServiceMock.update.mockResolvedValue(undefined);

    await expect(controller.update('missing', { name: 'X' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes product and returns void', async () => {
    productsServiceMock.remove.mockResolvedValue(true);

    await expect(controller.remove('p1')).resolves.toBeUndefined();
  });

  it('throws NotFoundException when deleting missing product', async () => {
    productsServiceMock.remove.mockResolvedValue(false);

    await expect(controller.remove('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
