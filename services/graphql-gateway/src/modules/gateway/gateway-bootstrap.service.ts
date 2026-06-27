import crypto from 'node:crypto';

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { Injectable } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { Request } from 'express';
import express from 'express';

import { pickForwardHeaders } from './gateway-forward-headers';
import { GatewayService } from './gateway.service';
import type { GatewayContext } from './gateway.types';

@Injectable()
export class GatewayBootstrapService {
  constructor(private readonly gatewayService: GatewayService) {}

  async mount(app: INestApplication) {
    const gateway = this.gatewayService.buildGateway();
    const apolloServer = new ApolloServer<GatewayContext>({
      gateway,
    });

    await apolloServer.start();

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(
      '/graphql',
      express.json(),
      expressMiddleware(apolloServer, {
        context: async ({ req }: { req: Request }) => {
          const requestIdHeader = req.headers['x-request-id'];
          const requestId =
            typeof requestIdHeader === 'string'
              ? requestIdHeader
              : crypto.randomUUID();

          return {
            authorization: req.headers.authorization,
            forwardedHeaders: pickForwardHeaders(req.headers),
            requestId,
          };
        },
      }),
    );
  }
}
