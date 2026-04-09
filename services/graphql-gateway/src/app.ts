import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import cors from 'cors';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { buildGateway } from './gateway/buildGateway.js';
import type { GatewayContext } from './gateway/dataSource.js';

export async function createApp() {
  const gateway = buildGateway();

  const app = express();
  const httpServer = http.createServer(app);

  app.use(helmet());
  app.use(morgan('dev'));

  const apolloServer = new ApolloServer<GatewayContext>({
    gateway,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        const requestIdHeader = req.headers['x-request-id'];
        const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : crypto.randomUUID();

        return {
          authorization: req.headers.authorization,
          requestId,
        };
      },
    }),
  );

  return { app, httpServer };
}
