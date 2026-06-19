import {
  ApolloGateway,
  IntrospectAndCompose,
  type ServiceEndpointDefinition,
} from '@apollo/gateway';
import { env } from '../env.js';
import { createRemoteDataSource } from './dataSource.js';

export function buildGateway() {
  return new ApolloGateway({
    supergraphSdl: new IntrospectAndCompose({
      subgraphs: [
        { name: 'product', url: env.PRODUCT_SUBGRAPH_URL },
        { name: 'cart', url: env.CART_SUBGRAPH_URL },
      ],
    }),
    buildService(definition: ServiceEndpointDefinition) {
      if (!definition.url) {
        throw new Error('Subgraph url is missing in ServiceEndpointDefinition');
      }
      return createRemoteDataSource(definition.url);
    },
  });
}
