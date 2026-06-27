import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApolloGateway,
  IntrospectAndCompose,
  RemoteGraphQLDataSource,
  type ServiceEndpointDefinition,
} from '@apollo/gateway';

import type { GatewayContext } from './gateway.types';

@Injectable()
export class GatewayService {
  constructor(private readonly configService: ConfigService) {}

  buildGateway() {
    return new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: [
          {
            name: 'product',
            url: this.configService.getOrThrow<string>(
              'gateway.productSubgraphUrl',
            ),
          },
          {
            name: 'cart',
            url: this.configService.getOrThrow<string>('gateway.cartSubgraphUrl'),
          },
          {
            name: 'order',
            url: this.configService.getOrThrow<string>('gateway.orderSubgraphUrl'),
          },
        ],
      }),
      buildService(definition: ServiceEndpointDefinition) {
        if (!definition.url) {
          throw new Error('Subgraph url is missing in ServiceEndpointDefinition');
        }

        return new RemoteGraphQLDataSource<GatewayContext>({
          url: definition.url,
          willSendRequest({ request, context }) {
            const headersToForward: Record<string, string> = {
              ...(context.forwardedHeaders ?? {}),
            };

            if (context.authorization) {
              headersToForward.authorization = context.authorization;
            }

            headersToForward['x-request-id'] = context.requestId;

            for (const [key, value] of Object.entries(headersToForward)) {
              if (value) {
                request.http?.headers.set(key, value);
              }
            }
          },
        });
      },
    });
  }
}
