# Docker Setup Guide

## Quick Start

### 1. Set Up Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```bash
# Database
DB_USER=gymapp
DB_PASSWORD=your_secure_password_here  # Change this!
DB_NAME=gymapp

# Auth (Clerk) - Get from https://dashboard.clerk.com
CLERK_SECRET_KEY=sk_test_your_actual_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key

# API URLs
EXPO_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000

# Environment
NODE_ENV=development
```

### 2. Start Services

```bash
# Start all services (database, server, web)
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

### 3. Initialize Database

```bash
# Run migrations
pnpm db:push

# Seed data
pnpm db:seed:all
```

## Services

The `docker-compose.yml` starts three services:

1. **Database (PostgreSQL 16)** - Port 5432
   - Container: `lifters-club-db`
   - Volume: `pgdata` (persistent storage)
   - Healthcheck enabled

2. **Server (Hono API)** - Port 4000
   - Container: `lifters-club-server`
   - Hot reload enabled
   - Depends on database

3. **Web (Next.js)** - Port 3000
   - Container: `lifters-club-web`
   - Hot reload enabled
   - Depends on server

## Common Commands

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d db

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Restart a service
docker-compose restart server

# View logs
docker-compose logs -f server

# Execute command in container
docker-compose exec db psql -U gymapp -d gymapp

# Rebuild images
docker-compose build --no-cache
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if database is healthy
docker-compose ps

# View database logs
docker-compose logs db

# Connect to database
docker-compose exec db psql -U gymapp -d gymapp
```

### Environment Variable Issues

If services fail to start with "required variable not set":

1. Ensure `.env` file exists: `ls -la .env`
2. Check all required variables are set: `cat .env`
3. Restart docker-compose: `docker-compose down && docker-compose up -d`

### Port Conflicts

If ports 3000, 4000, or 5432 are already in use:

```bash
# Find process using port
lsof -i :5432

# Kill process (replace PID)
kill -9 <PID>

# Or change ports in docker-compose.yml
```

## Development Workflow

### Using Docker Compose

```bash
# Start services
docker-compose up -d

# Watch logs
docker-compose logs -f

# Make code changes (hot reload is enabled)

# Rebuild if Dockerfile changes
docker-compose build server
docker-compose up -d server
```

### Using Local Development

If you prefer running services locally without Docker:

```bash
# Start database only
docker-compose up -d db

# Run server locally
pnpm --filter @gymapp/server dev

# Run web locally
pnpm --filter @gymapp/web dev

# Run mobile locally
pnpm --filter @gymapp/mobile dev
```

## Production Deployment

For production, use separate docker-compose file:

```bash
# Create docker-compose.prod.yml
# Set proper environment variables
# Use production Dockerfile targets

docker-compose -f docker-compose.prod.yml up -d
```

## Security Notes

- ✅ `.env` is in `.gitignore` - never commit it
- ✅ `docker-compose.yml` requires `.env` file - no hardcoded secrets
- ✅ Use strong passwords in production
- ✅ Rotate secrets regularly
- ✅ Use Docker secrets for production deployments

## Volumes

Data is persisted in Docker volume:

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect lifters-club_pgdata

# Backup volume
docker run --rm -v lifters-club_pgdata:/data -v $(pwd):/backup \
  alpine tar czf /backup/pgdata-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v lifters-club_pgdata:/data -v $(pwd):/backup \
  alpine tar xzf /backup/pgdata-backup.tar.gz -C /data
```

## Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
