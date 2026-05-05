import { ProductsService } from './products.service';

const createQuery = <T>(result: T) => ({
  exec: jest.fn().mockResolvedValue(result),
});

describe('ProductsService', () => {
  let service: ProductsService;
  const sellerActor = {
    userId: 'seller-1',
    roles: ['SELLER'],
    permissions: [],
    sellerProfile: { status: 'VERIFIED', isKycVerified: true },
  };
  const buyerActor = {
    userId: 'buyer-1',
    roles: ['BUYER'],
    permissions: [],
    sellerProfile: null,
  };
  const adminActor = {
    userId: 'admin-1',
    roles: ['ADMIN_MODERATOR'],
    permissions: [],
    sellerProfile: null,
  };

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
        {
          id: 'p1',
          sellerId: 'seller-1',
          name: 'Keyboard',
          price: 49.9,
          slug: 'keyboard-p1',
          status: 'APPROVED',
          categoryId: 'cat-keyboards',
          tags: ['peripherals'],
          attributes: { layout: 'US' },
        },
        {
          id: 'p2',
          sellerId: 'seller-2',
          name: 'Mouse',
          price: 19.9,
          slug: 'mouse-p2',
          status: 'APPROVED',
          categoryId: 'cat-mice',
          tags: ['peripherals'],
          attributes: { wireless: true },
        },
        {
          id: 'p3',
          sellerId: 'seller-3',
          name: 'Monitor',
          price: 199.0,
          slug: 'monitor-p3',
          status: 'APPROVED',
          categoryId: 'cat-monitors',
          tags: ['displays'],
          attributes: { size: 27 },
        },
      ]),
    );

    await expect(service.findAll(adminActor)).resolves.toHaveLength(3);
  });

  it('finds product by id', async () => {
    productModel.findOne.mockReturnValue(
      createQuery({
        id: 'p2',
        sellerId: 'seller-2',
        name: 'Mouse',
        price: 19.9,
        slug: 'mouse-p2',
        status: 'APPROVED',
        categoryId: 'cat-mice',
        tags: ['peripherals'],
        attributes: { wireless: true },
      }),
    );

    await expect(service.findById('p2', buyerActor)).resolves.toEqual({
      id: 'p2',
      sellerId: 'seller-2',
      name: 'Mouse',
      price: 19.9,
      slug: 'mouse-p2',
      status: 'APPROVED',
      categoryId: 'cat-mice',
      tags: ['peripherals'],
      attributes: { wireless: true },
    });
  });

  it('returns undefined when product id does not exist', async () => {
    productModel.findOne.mockReturnValue(createQuery(null));

    await expect(service.findById('missing', buyerActor)).resolves.toBeUndefined();
  });

  it('creates a new product with next id', async () => {
    productModel.find.mockReturnValue(
      createQuery([
        { id: 'p1' },
        { id: 'p2' },
        { id: 'p3' },
      ]),
    );
    productModel.create.mockResolvedValue({
      id: 'p4',
      sellerId: 'seller-1',
      name: 'Desk',
      price: 120,
      slug: 'desk-p4',
      status: 'DRAFT',
      categoryId: 'cat-desks',
      tags: ['furniture'],
      attributes: { color: 'oak' },
    });

    await expect(
      service.create(sellerActor, {
        name: 'Desk',
        price: 120,
        categoryId: 'cat-desks',
        tags: ['furniture'],
        attributes: { color: 'oak' },
      }),
    ).resolves.toEqual({
      id: 'p4',
      sellerId: 'seller-1',
      name: 'Desk',
      price: 120,
      slug: 'desk-p4',
      status: 'DRAFT',
      categoryId: 'cat-desks',
      tags: ['furniture'],
      attributes: { color: 'oak' },
    });
  });

  it('updates existing product fields', async () => {
    productModel.findOne.mockReturnValue(
      createQuery({
        id: 'p1',
        sellerId: 'seller-1',
        status: 'APPROVED',
      }),
    );
    productModel.findOneAndUpdate.mockReturnValue(
      createQuery({
        id: 'p1',
        sellerId: 'seller-1',
        name: 'Mechanical Keyboard',
        price: 59.9,
        slug: 'mechanical-keyboard-p1',
        status: 'APPROVED',
        categoryId: 'cat-keyboards',
        tags: ['peripherals'],
        attributes: { layout: 'US' },
      }),
    );

    await expect(
      service.update('p1', sellerActor, {
        name: 'Mechanical Keyboard',
        price: 59.9,
      }),
    ).resolves.toEqual({
      id: 'p1',
      sellerId: 'seller-1',
      name: 'Mechanical Keyboard',
      price: 59.9,
      slug: 'mechanical-keyboard-p1',
      status: 'APPROVED',
      categoryId: 'cat-keyboards',
      tags: ['peripherals'],
      attributes: { layout: 'US' },
    });
  });

  it('supports partial update', async () => {
    productModel.findOneAndUpdate.mockReturnValue(
      createQuery({
        id: 'p2',
        sellerId: 'seller-2',
        name: 'Mouse',
        price: 25.5,
        slug: 'mouse-p2',
        status: 'APPROVED',
        categoryId: 'cat-mice',
        tags: ['peripherals'],
        attributes: { wireless: true },
      }),
    );
    productModel.findOne.mockReturnValue(
      createQuery({
        id: 'p2',
        sellerId: 'seller-2',
        status: 'APPROVED',
      }),
    );

    await expect(service.update('p2', adminActor, { price: 25.5 })).resolves.toEqual({
      id: 'p2',
      sellerId: 'seller-2',
      name: 'Mouse',
      price: 25.5,
      slug: 'mouse-p2',
      status: 'APPROVED',
      categoryId: 'cat-mice',
      tags: ['peripherals'],
      attributes: { wireless: true },
    });
  });

  it('returns undefined when updating missing product', async () => {
    productModel.findOne.mockReturnValue(createQuery(null));

    await expect(
      service.update('missing', sellerActor, { name: 'Nope' }),
    ).resolves.toBeUndefined();
  });

  it('removes product by id', async () => {
    productModel.findOne.mockReturnValue(
      createQuery({ id: 'p3', sellerId: 'seller-1', status: 'APPROVED' }),
    );
    productModel.deleteOne.mockReturnValue(createQuery({ deletedCount: 1 }));

    await expect(service.remove('p3', sellerActor)).resolves.toBe(true);
  });

  it('returns false when removing missing product', async () => {
    productModel.findOne.mockReturnValue(createQuery(null));

    await expect(service.remove('missing', sellerActor)).resolves.toBe(false);
  });

  it('submits product for review', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    productModel.findOne.mockReturnValue(
      createQuery({
        id: 'p1',
        sellerId: 'seller-1',
        name: 'Keyboard',
        price: 49.9,
        slug: 'keyboard-p1',
        status: 'DRAFT',
        save,
      }),
    );

    await expect(service.submitForReview('p1', sellerActor)).resolves.toMatchObject({
      id: 'p1',
      status: 'PENDING_REVIEW',
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('approves product from pending review', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    productModel.findOne.mockReturnValue(
      createQuery({
        id: 'p1',
        sellerId: 'seller-1',
        name: 'Keyboard',
        price: 49.9,
        slug: 'keyboard-p1',
        status: 'PENDING_REVIEW',
        save,
      }),
    );

    await expect(service.approve('p1')).resolves.toMatchObject({
      id: 'p1',
      status: 'APPROVED',
    });
  });
});
