import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';

import { env } from './env.js';
import { asyncHandler } from './common/middlewares/asyncHandler.js';
import { errorHandler } from './common/middlewares/errorHandler.js';
import { prisma } from './db/prisma.js';
import authRouter from './modules/auth/auth.router.js';
import usersRouter from './modules/users/users.router.js';
import { buildOpenApiSpec } from './openapi/buildOpenApiSpec.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(morgan('dev'));

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  const openapi = buildOpenApiSpec();
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));

  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, service: 'user-service' });
    }),
  );

  app.get('/api/users/ping', (_req, res) => {
    res.json({ ping: 'pong' });
  });

  app.use('/api/users/auth', authRouter);
  app.use('/api/users', usersRouter);

  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  app.use(
    '/api/users/files',
    express.static(uploadsRoot, {
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    }),
  );

  app.use(errorHandler);

  return app;
}
