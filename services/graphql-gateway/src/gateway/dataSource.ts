import { RemoteGraphQLDataSource } from '@apollo/gateway';

export type GatewayContext = {
  authorization?: string;
  forwardedHeaders?: Record<string, string>;
  requestId: string;
};

export function createRemoteDataSource(url: string) {
  return new RemoteGraphQLDataSource<GatewayContext>({
    url,
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
}
