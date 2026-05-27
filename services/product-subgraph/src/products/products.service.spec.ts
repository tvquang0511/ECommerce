import { ProductsService } from './products.service';

type QueryResult<T> = { exec: jest.Mock<Promise<T>, []> };

const createQuery = <T>(result: T): QueryResult<T> => ({
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

  const minioService = {
    removeObject: jest.fn().mockResolvedValue(undefined),
    presignPutObject: jest.fn().mockResolvedValue({ url: 'upload', expiresAt: new Date() }),
    presignGetObject: jest.fn().mockResolvedValue({ url: 'download', expiresAt: new Date() }),
    getBucket: jest.fn().mockReturnValue('product-private'),
  };

  const productCache = {
    getList: jest.fn(),
    setList: jest.fn().mockResolvedValue(undefined),
    getDetail: jest.fn(),
    setDetail: jest.fn().mockResolvedValue(undefined),
    invalidateProduct: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    productModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
    };

    productCache.getList.mockResolvedValue(null);
    productCache.getDetail.mockResolvedValue(null);

    service = new ProductsService(
      productModel as never,
      minioService as never,
      productCache as never,
    );
  });

  it('returns products from database when cache miss', async () => {
    productModel.find.mockReturnValue(
      createQuery([
        {
          id: 'p1',
          sellerId: 'seller-1',
          name: 'Keyboard',
          sku: 'KB-01',
          price: 49.9,
          salePrice: null,
          currency: 'VND',
          slug: 'keyboard-p1',
          status: 'APPROVED',
          categoryId: 'cat-keyboards',
          tags: ['peripherals'],
          attributes: { layout: 'US' },
          coverImage: null,
          galleryImages: [],
        },
      ]),
    );

    await expect(service.findAll(adminActor)).resolves.toHaveLength(1);
    expect(productCache.setList).toHaveBeenCalledTimes(1);
  });

  it('returns cached products when cache hit', async () => {
    productCache.getList.mockResolvedValue([{ id: 'p1' }]);

    await expect(service.findAll(buyerActor)).resolves.toEqual([{ id: 'p1' }]);
    expect(productModel.find).not.toHaveBeenCalled();
  });

  it('finds product by id', async () => {
    productModel.findOne.mockReturnValue(
      createQuery({
        id: 'p2',
        sellerId: 'seller-2',
        name: 'Mouse',
        sku: 'MOUSE-01',
        price: 19.9,
        salePrice: null,
        currency: 'VND',
        slug: 'mouse-p2',
        status: 'APPROVED',
        categoryId: 'cat-mice',
        tags: ['peripherals'],
        attributes: { wireless: true },
        coverImage: null,
        galleryImages: [],
      }),
    );

    await expect(service.findById('p2', buyerActor)).resolves.toMatchObject({
      id: 'p2',
      sellerId: 'seller-2',
      name: 'Mouse',
      sku: 'MOUSE-01',
      price: 19.9,
      currency: 'VND',
    });
  });

  it('returns undefined when product id does not exist', async () => {
    productModel.findOne.mockReturnValue(createQuery(null));

    await expect(service.findById('missing', buyerActor)).resolves.toBeUndefined();
  });

  it('creates a new product with next id', async () => {
    productModel.find.mockReturnValue(createQuery([{ id: 'p1' }, { id: 'p2' }]));
    productModel.create.mockResolvedValue({
      id: 'p3',
      sellerId: 'seller-1',
      name: 'Desk',
      sku: 'DESK-01',
      price: 120,
      salePrice: null,
      currency: 'VND',
      slug: 'desk-p3',
      status: 'DRAFT',
      categoryId: 'cat-desks',
      tags: ['furniture'],
      attributes: { color: 'oak' },
      coverImage: null,
      galleryImages: [],
    });

    await expect(
      service.create(sellerActor, {
        name: 'Desk',
        price: 120,
        sku: 'DESK-01',
        categoryId: 'cat-desks',
        tags: ['furniture'],
        attributes: { color: 'oak' },
      }),
    ).resolves.toMatchObject({
      id: 'p3',
      sellerId: 'seller-1',
      name: 'Desk',
      sku: 'DESK-01',
      price: 120,
      status: 'DRAFT',
    });

    expect(productCache.invalidateProduct).toHaveBeenCalledTimes(1);
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
        sku: 'KB-01',
        price: 59.9,
        salePrice: null,
        currency: 'VND',
        slug: 'mechanical-keyboard-p1',
        status: 'APPROVED',
        categoryId: 'cat-keyboards',
        tags: ['peripherals'],
        attributes: { layout: 'US' },
        coverImage: null,
        galleryImages: [],
      }),
    );

    await expect(
      service.update('p1', sellerActor, {
        name: 'Mechanical Keyboard',
        price: 59.9,
      }),
    ).resolves.toMatchObject({
      id: 'p1',
      name: 'Mechanical Keyboard',
      price: 59.9,
    });

    expect(productCache.invalidateProduct).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when updating missing product', async () => {
    productModel.findOne.mockReturnValue(createQuery(null));

    await expect(
      service.update('missing', sellerActor, { name: 'Nope' }),
    ).resolves.toBeUndefined();
  });

  it('removes product by id', async () => {
    productModel.findOne.mockReturnValue(
      createQuery({
        id: 'p3',
        sellerId: 'seller-1',
        status: 'APPROVED',
        coverImage: null,
        galleryImages: [],
      }),
    );
    productModel.deleteOne.mockReturnValue(createQuery({ deletedCount: 1 }));

    await expect(service.remove('p3', sellerActor)).resolves.toBe(true);
    expect(productCache.invalidateProduct).toHaveBeenCalledTimes(1);
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
        sku: 'KB-01',
        price: 49.9,
        salePrice: null,
        currency: 'VND',
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
        sku: 'KB-01',
        price: 49.9,
        salePrice: null,
        currency: 'VND',
        slug: 'keyboard-p1',
        status: 'PENDING_REVIEW',
        save,
      }),
    );

    await expect(service.approve('p1')).resolves.toMatchObject({
      id: 'p1',
      status: 'APPROVED',
    });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
