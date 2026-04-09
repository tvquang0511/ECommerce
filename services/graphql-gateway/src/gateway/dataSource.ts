import { RemoteGraphQLDataSource } from '@apollo/gateway';

export type GatewayContext = {
  authorization?: string;
  requestId: string;
};

export function createRemoteDataSource(url: string) {
  return new RemoteGraphQLDataSource<GatewayContext>({
    url,
    willSendRequest({ request, context }) {
      if (context.authorization) {
        request.http?.headers.set('authorization', context.authorization);
      }

      request.http?.headers.set('x-request-id', context.requestId);
    },
  });
}
