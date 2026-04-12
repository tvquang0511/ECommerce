# Minimal dev/prod-ish image for user-service (API + worker share this image)
FROM node:20-alpine

WORKDIR /app

RUN corepack enable

# Workspace manifests
COPY package.json pnpm-workspace.yaml ./

# Copy workspace packages that user-service depends on
COPY packages/tsconfig packages/tsconfig
COPY packages/common packages/common

# Copy service manifest first for better caching
COPY services/user-service/package.json services/user-service/package.json
COPY services/user-service/tsconfig.json services/user-service/tsconfig.json
COPY services/user-service/prisma services/user-service/prisma
COPY services/user-service/prisma.config.ts services/user-service/prisma.config.ts

# Install deps for this service (and its workspace deps)
RUN pnpm install --filter user-service...

# Copy only runtime source (avoid copying local .env/.keys into the image)
COPY services/user-service/src services/user-service/src
COPY services/user-service/README.md services/user-service/README.md

EXPOSE 4001

CMD ["pnpm", "--filter", "user-service", "start"]
