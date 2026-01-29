# Base stage
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY .npmrc* ./
COPY apps/server/package.json ./apps/server/
COPY packages/types/package.json ./packages/types/
COPY packages/db/package.json ./packages/db/
COPY packages/engine/package.json ./packages/engine/
COPY packages/validation/package.json ./packages/validation/
RUN pnpm install --frozen-lockfile

# Development stage
FROM deps AS dev
COPY . .
WORKDIR /app/apps/server
CMD ["pnpm", "dev"]

# Production stage - use tsx to run TypeScript directly
# This avoids ESM module resolution issues with compiled JS
FROM deps AS prod
COPY . .
# Build the dependency packages (types, validation, db, engine)
RUN pnpm turbo build --filter=@gymapp/server^...
WORKDIR /app/apps/server
ENV NODE_ENV=production
# Run TypeScript directly with tsx instead of compiled JS
CMD ["npx", "tsx", "src/index.ts"]
