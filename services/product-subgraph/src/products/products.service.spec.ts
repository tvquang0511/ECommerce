import { ProductsService } from './products.service';

const createQuery = <T>(result: T) => ({
  exec: jest.fn().mockResolvedValue(result),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let productModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
  };

  beforeEach(() => {
    productModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
    };

    service = new ProductsService(productModel as never);
  });

  it('returns products from database', async () => {
    productModel.find.mockReturnValue(
      createQuery([
        { id: 'p1', name: 'Keyboard', price: 49.9 },
        { id: 'p2', name: 'Mouse', price: 19.9 },
        { id: 'p3', name: 'Monitor', price: 199.0 },
      ]),
    );

    await expect(service.findAll()).resolves.toHaveLength(3);
  });

  it('finds product by id', async () => {
    productModel.findOne.mockReturnValue(
      createQuery({ id: 'p2', name: 'Mouse', price: 19.9 }),
    );

    await expect(service.findById('p2')).resolves.toEqual({
      id: 'p2',
      name: 'Mouse',
      price: 19.9,
    });
  });

  it('returns undefined when product id does not exist', async () => {
    productModel.findOne.mockReturnValue(createQuery(null));

    await expect(service.findById('missing')).resolves.toBeUndefined();
  });

  it('creates a new product with next id', async () => {
    productModel.find.mockReturnValue(
      createQuery([
        { id: 'p1', name: 'Keyboard', price: 49.9 },
        { id: 'p2', name: 'Mouse', price: 19.9 },
        { id: 'p3', name: 'Monitor', price: 199.0 },
      ]),
    );
    productModel.create.mockResolvedValue({
      id: 'p4',
      name: 'Desk',
      price: 120,
    });

    await expect(service.create({ name: 'Desk', price: 120 })).resolves.toEqual(
      { id: 'p4', name: 'Desk', price: 120 },
    );
  });

  it('updates existing product fields', async () => {
    productModel.findOneAndUpdate.mockReturnValue(
      createQuery({ id: 'p1', name: 'Mechanical Keyboard', price: 59.9 }),
    );

    await expect(
      service.update('p1', {
        name: 'Mechanical Keyboard',
        price: 59.9,
      }),
    ).resolves.toEqual({
      id: 'p1',
      name: 'Mechanical Keyboard',
      price: 59.9,
    });
  });

  it('supports partial update', async () => {
    productModel.findOneAndUpdate.mockReturnValue(
      createQuery({ id: 'p2', name: 'Mouse', price: 25.5 }),
    );

    await expect(service.update('p2', { price: 25.5 })).resolves.toEqual({
      id: 'p2',
      name: 'Mouse',
      price: 25.5,
    });
  });

  it('returns undefined when updating missing product', async () => {
    productModel.findOneAndUpdate.mockReturnValue(createQuery(null));

    await expect(
      service.update('missing', { name: 'Nope' }),
    ).resolves.toBeUndefined();
  });

  it('removes product by id', async () => {
    productModel.deleteOne.mockReturnValue(createQuery({ deletedCount: 1 }));

    await expect(service.remove('p3')).resolves.toBe(true);
  });

  it('returns false when removing missing product', async () => {
    productModel.deleteOne.mockReturnValue(createQuery({ deletedCount: 0 }));

    await expect(service.remove('missing')).resolves.toBe(false);
  });
});
