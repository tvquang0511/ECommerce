# Minimal dev/prod-ish image for cart-subgraph
FROM node:20-alpine

WORKDIR /app

# Enable pnpm via Corepack
RUN corepack enable

# Copy only what we need to install dependencies for this workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/tsconfig packages/tsconfig
COPY packages/eslint-config packages/eslint-config
COPY services/cart-subgraph/package.json services/cart-subgraph/package.json

# Install deps (no frozen lockfile to keep bootstrap-friendly for day-1)
RUN pnpm install --filter cart-subgraph...

# Copy source
COPY services/cart-subgraph services/cart-subgraph

EXPOSE 4003

CMD ["pnpm", "--filter", "cart-subgraph", "start"]
