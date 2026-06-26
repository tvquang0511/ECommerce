FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config packages/eslint-config
COPY services/order-subgraph/package.json services/order-subgraph/package.json
COPY services/order-subgraph/tsconfig.json services/order-subgraph/tsconfig.json
COPY services/order-subgraph/prisma services/order-subgraph/prisma
COPY services/order-subgraph/prisma.config.ts services/order-subgraph/prisma.config.ts

RUN pnpm install --filter order-subgraph...

COPY services/order-subgraph services/order-subgraph

EXPOSE 4004

CMD ["sh", "-c", "cd services/order-subgraph && pnpm prisma:generate && pnpm start"]
