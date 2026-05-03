import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { ProductModel } from './../src/products/product.schema';

const initialProducts = [
  { id: 'p1', name: 'Keyboard', price: 49.9 },
  { id: 'p2', name: 'Mouse', price: 19.9 },
  { id: 'p3', name: 'Monitor', price: 199 },
];

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
        { id: 'p1', name: 'Keyboard', price: 49.9 },
        { id: 'p2', name: 'Mouse', price: 19.9 },
        { id: 'p3', name: 'Monitor', price: 199 },
      ]);
  });

  it('/products/:id (GET)', () => {
    return request(app.getHttpServer())
      .get('/products/p1')
      .expect(200)
      .expect({ id: 'p1', name: 'Keyboard', price: 49.9 });
  });

  it('/products (POST)', () => {
    return request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Desk', price: 120 })
      .expect(201)
      .expect({ id: 'p4', name: 'Desk', price: 120 });
  });

  it('/products/:id (PUT)', () => {
    return request(app.getHttpServer())
      .put('/products/p1')
      .send({ name: 'Mechanical Keyboard', price: 59.9 })
      .expect(200)
      .expect({ id: 'p1', name: 'Mechanical Keyboard', price: 59.9 });
  });

  it('/products/:id (PUT) invalid payload', () => {
    return request(app.getHttpServer())
      .put('/products/p1')
      .send({ name: 123, price: -2, extra: true })
      .expect(400);
  });

  it('/products/:id (PUT) not found', () => {
    return request(app.getHttpServer())
      .put('/products/missing')
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
    return request(app.getHttpServer()).delete('/products/p3').expect(204);
  });

  it('/products/:id (DELETE) then GET should be 404', async () => {
    await request(app.getHttpServer()).delete('/products/p2').expect(204);

    await request(app.getHttpServer()).get('/products/p2').expect(404);
  });

  it('/products/:id (DELETE) not found', () => {
    return request(app.getHttpServer())
      .delete('/products/missing')
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
      .send({ name: 123, price: -1, extra: true })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await mongoServer.stop();
    delete process.env.MONGO_URI;
  });
});
