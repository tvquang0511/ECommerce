# Minimal dev/prod-ish image for graphql-gateway
FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY services/graphql-gateway/package.json services/graphql-gateway/package.json

RUN pnpm install --filter graphql-gateway...

COPY services/graphql-gateway services/graphql-gateway

EXPOSE 4000

CMD ["pnpm", "--filter", "graphql-gateway", "start"]
