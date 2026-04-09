# Minimal dev/prod-ish image for product-subgraph
FROM node:20-alpine

WORKDIR /app

# Enable pnpm via Corepack
RUN corepack enable

# Copy only what we need to install dependencies for this workspace
COPY package.json pnpm-workspace.yaml ./
COPY services/product-subgraph/package.json services/product-subgraph/package.json

# Install deps (no frozen lockfile to keep bootstrap-friendly for day-1)
RUN pnpm install --filter product-subgraph...

# Copy source
COPY services/product-subgraph services/product-subgraph

EXPOSE 4002

CMD ["pnpm", "--filter", "product-subgraph", "start"]
