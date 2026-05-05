import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { ProductModel } from './../src/products/product.schema';

jest.setTimeout(60000);

const initialProducts = [
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
    price: 199,
    slug: 'monitor-p3',
    status: 'APPROVED',
    categoryId: 'cat-monitors',
    tags: ['displays'],
    attributes: { size: 27 },
  },
];

const sellerHeaders = {
  'x-dev-user-id': 'seller-1',
  'x-dev-roles': 'SELLER',
  'x-dev-seller-status': 'VERIFIED',
  'x-dev-kyc-verified': 'true',
};

const adminHeaders = {
  'x-dev-user-id': 'admin-1',
  'x-dev-roles': 'ADMIN_MODERATOR',
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri('product-subgraph');
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const productModel = moduleFixture.get<Model<any>>(
      getModelToken(ProductModel.name),
    );

    await productModel.deleteMany({});
    await productModel.insertMany(initialProducts);

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello NestJS');
  });

  it('/products (GET)', () => {
    return request(app.getHttpServer())
      .get('/products')
      .expect(200)
      .expect([
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
          price: 199,
          slug: 'monitor-p3',
          status: 'APPROVED',
          categoryId: 'cat-monitors',
          tags: ['displays'],
          attributes: { size: 27 },
        },
      ]);
  });

  it('/products/:id (GET)', () => {
    return request(app.getHttpServer())
      .get('/products/p1')
      .expect(200)
      .expect({
        id: 'p1',
        sellerId: 'seller-1',
        name: 'Keyboard',
        price: 49.9,
        slug: 'keyboard-p1',
        status: 'APPROVED',
        categoryId: 'cat-keyboards',
        tags: ['peripherals'],
        attributes: { layout: 'US' },
      });
  });

  it('/products (POST)', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set(sellerHeaders)
      .send({
        name: 'Desk',
        price: 120,
        categoryId: 'cat-desks',
        tags: ['furniture'],
        attributes: { color: 'oak' },
      })
      .expect(201)
      .expect({
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

  it('/products/:id (PUT)', () => {
    return request(app.getHttpServer())
      .put('/products/p1')
      .set(sellerHeaders)
      .send({ name: 'Mechanical Keyboard', price: 59.9 })
      .expect(200)
      .expect({
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

  it('/products/:id (PUT) invalid payload', () => {
    return request(app.getHttpServer())
      .put('/products/p1')
      .set(sellerHeaders)
      .send({ name: 123, price: -2, extra: true })
      .expect(400);
  });

  it('/products/:id (PUT) not found', () => {
    return request(app.getHttpServer())
      .put('/products/missing')
      .set(sellerHeaders)
      .send({ name: 'Nope' })
      .expect(404)
      .expect((res) => {
        const body = res.body as { message?: string | string[] };
        const message = Array.isArray(body.message)
          ? body.message.join(' ')
          : (body.message ?? '');

        expect(message).toContain('Product missing not found');
      });
  });

  it('/products/:id (DELETE)', () => {
    return request(app.getHttpServer())
      .delete('/products/p3')
      .set(adminHeaders)
      .expect(204);
  });

  it('/products/:id (DELETE) then GET should be 404', async () => {
    await request(app.getHttpServer())
      .delete('/products/p2')
      .set(adminHeaders)
      .expect(204);

    await request(app.getHttpServer()).get('/products/p2').expect(404);
  });

  it('/products/:id (DELETE) not found', () => {
    return request(app.getHttpServer())
      .delete('/products/missing')
      .set(adminHeaders)
      .expect(404)
      .expect((res) => {
        const body = res.body as { message?: string | string[] };
        const message = Array.isArray(body.message)
          ? body.message.join(' ')
          : (body.message ?? '');

        expect(message).toContain('Product missing not found');
      });
  });

  it('/products/:id (GET) not found', () => {
    return request(app.getHttpServer())
      .get('/products/unknown')
      .expect(404)
      .expect((res) => {
        const body = res.body as { message?: string | string[] };
        const message = Array.isArray(body.message)
          ? body.message.join(' ')
          : (body.message ?? '');

        expect(message).toContain('Product unknown not found');
      });
  });

  it('/products (POST) invalid payload', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set(sellerHeaders)
      .send({ name: 123, price: -1, extra: true })
      .expect(400);
  });

  it('/products/:id/submit (POST)', () => {
    return request(app.getHttpServer())
      .post('/products')
      .set(sellerHeaders)
      .send({
        name: 'Draft Chair',
        price: 90,
      })
      .expect(201)
      .then(() => {
        return request(app.getHttpServer())
          .post('/products/p4/submit')
          .set(sellerHeaders)
          .expect(201)
          .expect((res) => {
            expect(res.body.status).toBe('PENDING_REVIEW');
          });
      });
  });

  it('/products/:id/approve (POST)', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set(sellerHeaders)
      .send({
        name: 'Draft Lamp',
        price: 45,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/products/p4/submit')
      .set(sellerHeaders)
      .expect(201);

    await request(app.getHttpServer())
      .post('/products/p4/approve')
      .set(adminHeaders)
      .expect(201)
      .expect((res) => {
        expect(res.body.status).toBe('APPROVED');
      });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    await mongoServer.stop();
    delete process.env.MONGO_URI;
  });
});
