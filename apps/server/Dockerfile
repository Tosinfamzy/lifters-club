# Base stage
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
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

# Build stage
FROM deps AS build
COPY . .
RUN pnpm --filter @gymapp/server build

# Production stage
FROM base AS prod
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
