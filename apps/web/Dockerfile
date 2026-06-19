# Base stage
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/validation/package.json ./packages/validation/
RUN pnpm install --frozen-lockfile

# Development stage
FROM deps AS dev
COPY . .
WORKDIR /app/apps/web
CMD ["pnpm", "dev"]

# Build stage
FROM deps AS build
COPY . .
RUN pnpm --filter @gymapp/web build

# Production stage
FROM base AS prod
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./.next/static
COPY --from=build /app/apps/web/public ./public
CMD ["node", "server.js"]
