import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

  afterEach(async () => {
    await app.close();
  });
});
