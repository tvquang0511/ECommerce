FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config packages/eslint-config
COPY services/payment-service/package.json services/payment-service/package.json
COPY services/payment-service/tsconfig.json services/payment-service/tsconfig.json

RUN pnpm install --filter payment-service...

COPY services/payment-service services/payment-service

EXPOSE 4020

CMD ["sh", "-c", "cd services/payment-service && pnpm start"]
