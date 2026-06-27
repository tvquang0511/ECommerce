export type GatewayContext = {
  authorization?: string;
  forwardedHeaders?: Record<string, string>;
  requestId: string;
};
