.PHONY: help up up-db down restart logs logs-db logs-server logs-web db-shell migrate seed seed-programs seed-all build clean dev \
	dev-server dev-web dev-mobile test test-watch test-server test-engine \
	lint typecheck api-docs status install mobile mobile-ios mobile-android studio reset

# Default target - show help
.DEFAULT_GOAL := help

# Show available commands
help:
	@echo "Lifters Club - Available Commands"
	@echo "=================================="
	@echo ""
	@echo "Docker:"
	@echo "  make up           - Start all services"
	@echo "  make up-db        - Start only the database"
	@echo "  make down         - Stop all services"
	@echo "  make restart      - Restart all services"
	@echo "  make status       - Show container status"
	@echo "  make logs         - View all logs"
	@echo "  make logs-db      - View database logs"
	@echo "  make logs-server  - View server logs"
	@echo ""
	@echo "Database:"
	@echo "  make db-shell     - Open PostgreSQL shell"
	@echo "  make db-push      - Push schema (dev only)"
	@echo "  make migrate      - Run migrations"
	@echo "  make seed         - Seed exercises (local)"
	@echo "  make seed-programs - Seed training programs (local)"
	@echo "  make seed-all     - Seed everything (local)"
	@echo "  make seed-prod    - Seed exercises (production, needs DATABASE_URL)"
	@echo "  make seed-all-prod - Seed everything (production, needs DATABASE_URL)"
	@echo "  make studio       - Open Drizzle Studio"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Run all dev servers (server + web)"
	@echo "  make dev-server   - Run only API server"
	@echo "  make dev-web      - Run only web app"
	@echo "  make dev-mobile   - Run mobile app (Expo)"
	@echo "  make install      - Install dependencies"
	@echo ""
	@echo "Mobile:"
	@echo "  make mobile       - Start Expo dev server"
	@echo "  make mobile-ios   - Run on iOS simulator"
	@echo "  make mobile-android - Run on Android emulator"
	@echo ""
	@echo "Quality:"
	@echo "  make test         - Run all tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo "  make test-server  - Run server tests only"
	@echo "  make test-engine  - Run engine tests only"
	@echo "  make typecheck    - Run TypeScript checks"
	@echo "  make lint         - Run linter"
	@echo ""
	@echo "Build:"
	@echo "  make build        - Build all packages"
	@echo "  make clean        - Remove all artifacts"
	@echo "  make reset        - Full reset and reinstall"
	@echo ""
	@echo "Docs:"
	@echo "  make api-docs     - Open API documentation"
	@echo ""

# ============ Docker ============

# Start all services
up:
	docker compose up -d

# Start only the database
up-db:
	docker compose up -d db

# Stop all services
down:
	docker compose down

# Restart all services
restart:
	docker compose restart

# View logs (all services)
logs:
	docker compose logs -f

# View logs (specific service)
logs-db:
	docker compose logs -f db

logs-server:
	docker compose logs -f server

logs-web:
	docker compose logs -f web

# Show container status
status:
	docker compose ps

# ============ Database ============

# Open PostgreSQL shell
db-shell:
	docker compose exec db psql -U $${DB_USER:-gymapp} -d $${DB_NAME:-gymapp}

# Generate and run database migrations (use db-push for dev)
migrate:
	@echo "Generating migrations from schema changes..."
	pnpm db:generate
	@echo "Running migrations..."
	pnpm db:migrate

# Push schema directly (dev only)
db-push:
	pnpm db:push

# Seed the exercises (local)
seed:
	pnpm --filter @gymapp/db db:seed

# Seed training programs (local)
seed-programs:
	pnpm --filter @gymapp/db db:seed:programs

# Seed everything (local)
seed-all:
	pnpm --filter @gymapp/db db:seed:all

# Seed production database (requires DATABASE_URL env var)
seed-prod:
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL not set"; exit 1; fi
	pnpm --filter @gymapp/db db:seed

# Seed production programs (requires DATABASE_URL env var)
seed-programs-prod:
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL not set"; exit 1; fi
	pnpm --filter @gymapp/db db:seed:programs

# Seed everything in production (requires DATABASE_URL env var)
seed-all-prod:
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL not set"; exit 1; fi
	pnpm --filter @gymapp/db db:seed:all

# Open Drizzle Studio
studio:
	pnpm db:studio

# ============ Development ============

# Run development servers (server + web via turbo)
dev:
	pnpm dev

# Run only the API server in dev mode
dev-server:
	pnpm --filter @gymapp/server dev

# Run only the web app in dev mode
dev-web:
	pnpm --filter @gymapp/web dev

# Run mobile app in dev mode
dev-mobile:
	pnpm --filter @gymapp/mobile start

# Install dependencies
install:
	pnpm install

# ============ Mobile ============

# Start Expo dev server
mobile:
	pnpm mobile

# Run on iOS simulator
mobile-ios:
	pnpm mobile:ios

# Run on Android emulator
mobile-android:
	pnpm mobile:android

# ============ Quality ============

# Run tests
test:
	pnpm test

# Run tests in watch mode (engine only - has watch support)
test-watch:
	pnpm --filter @gymapp/engine test:watch

# Run server tests only
test-server:
	pnpm --filter @gymapp/server test

# Run engine tests only
test-engine:
	pnpm --filter @gymapp/engine test

# TypeScript type checking
typecheck:
	pnpm typecheck

# Run linter
lint:
	pnpm lint

# ============ Build ============

# Build all packages
build:
	pnpm build

# Clean everything
clean:
	docker compose down -v
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/*/.next
	rm -rf apps/*/.expo
	rm -rf apps/*/dist
	rm -rf packages/*/dist

# Full reset: clean + reinstall + start
reset: clean
	pnpm install
	make up-db
	sleep 5
	make db-push
	make seed-all

# ============ Docs ============

# Open API documentation in browser
api-docs:
	@echo "Opening API docs at http://localhost:4000/api/docs"
	@open http://localhost:4000/api/docs 2>/dev/null || xdg-open http://localhost:4000/api/docs 2>/dev/null || echo "Visit: http://localhost:4000/api/docs"
