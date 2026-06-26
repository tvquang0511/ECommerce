FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY scripts scripts
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config packages/eslint-config
COPY services/inventory-service/package.json services/inventory-service/package.json
COPY services/inventory-service/tsconfig.json services/inventory-service/tsconfig.json

RUN pnpm install --filter inventory-service...

COPY services/inventory-service services/inventory-service

EXPOSE 4010

CMD ["sh", "-c", "cd services/inventory-service && pnpm start"]
