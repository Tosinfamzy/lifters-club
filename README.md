# Lifters Club

A **training decision engine** that transforms workout history into intelligent, justified training decisions. Built as a modern monorepo with React Native mobile app, Hono backend API, and Next.js admin dashboard.

## 🏗️ Monorepo Structure

```
lifters-club/
├── apps/
│   ├── mobile/          # 📱 React Native + Expo app
│   ├── server/          # 🔧 Hono backend API
│   └── web/             # 💻 Next.js admin dashboard
│
├── packages/
│   ├── db/              # 🗄️  Drizzle ORM + PostgreSQL schemas
│   ├── engine/          # 🧠 Decision engine (progression, volume, rotation)
│   ├── types/           # 📦 Shared TypeScript types
│   └── validation/      # ✅ Zod validation schemas
│
├── docs/adr/            # 📚 Architecture Decision Records
└── scripts/             # 🔨 Utility scripts
```

## ✨ Features

### Mobile App
- 🏋️ **Exercise Substitution Flow** - Find alternative exercises with match scores
- ⚡ **Offline-First** - Full functionality without internet
- 📊 **Progress Tracking** - Volume, RPE, and performance charts
- 🎯 **Smart Decisions** - AI-powered load and volume recommendations
- ✅ **52 Unit Tests** - 90%+ coverage on core components

### Backend API
- 🔐 **Clerk Authentication** - Secure user management
- 📈 **Decision Engine API** - Load progression, volume adjustment, exercise rotation
- 🎯 **Exercise Library** - 140+ exercises with metadata
- 💾 **PostgreSQL** - Separate schemas for exercise library and training data

### Shared Packages
- 📦 **Types** - Type-safe across all apps
- 🧠 **Engine** - Pure functions for training decisions
- 🗄️  **Database** - Centralized schema and migrations
- ✅ **Validation** - Consistent data validation

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL 16+
- Docker (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/lifters-club.git
cd lifters-club

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Start PostgreSQL (if using Docker)
docker-compose up -d postgres

# Run database migrations
pnpm db:push

# Seed database
pnpm db:seed:all
```

### Development

```bash
# Start all development servers
pnpm dev

# Or start individually:
pnpm --filter @gymapp/mobile dev      # Mobile on http://localhost:8081
pnpm --filter @gymapp/server dev      # Server on http://localhost:4000
pnpm --filter @gymapp/web dev         # Web on http://localhost:3000
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @gymapp/mobile test
pnpm --filter @gymapp/server test

# Test with coverage
pnpm test:coverage
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @gymapp/mobile build
```

## 📱 Mobile App Setup

### iOS

```bash
# Install dependencies
pnpm install

# Start Expo
pnpm mobile:ios
```

### Android

```bash
# Install dependencies
pnpm install

# Start Expo
pnpm mobile:android
```

## 🧪 Testing

- **Mobile**: Jest + React Native Testing Library (52 tests)
- **Server**: Vitest (integration tests)
- **Engine**: Vitest (95%+ coverage)

```bash
# Run all tests
pnpm test

# Watch mode
pnpm --filter @gymapp/mobile test:watch

# Coverage report
pnpm test:coverage
```

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | Turborepo + pnpm workspaces |
| **Mobile** | React Native + Expo 54 |
| **Backend** | Hono (TypeScript) |
| **Web** | Next.js 15 (App Router) |
| **Database** | PostgreSQL 16 + Drizzle ORM |
| **Validation** | Zod |
| **Auth** | Clerk |
| **Styling** | Tailwind + shadcn/ui |
| **Testing** | Jest (mobile), Vitest (server/packages) |
| **Offline** | AsyncStorage + offline queue |

## 🗂️ Project Structure

### Apps

#### Mobile (`apps/mobile/`)
- React Native + Expo app
- Offline-first architecture
- Exercise substitution flow with match scores
- Workout tracking with RPE and volume
- Progress charts and analytics

#### Server (`apps/server/`)
- Hono backend API
- RESTful endpoints
- Decision engine integration
- Database access layer

#### Web (`apps/web/`)
- Next.js 15 admin dashboard
- Server-side rendering
- Tailwind + shadcn/ui

### Packages

#### Database (`packages/db/`)
- Drizzle ORM setup
- Schema definitions
- Migration scripts
- Seed data

#### Engine (`packages/engine/`)
- Load progression algorithm
- Volume adjustment logic
- Exercise rotation system
- Pure functions (no I/O)

#### Types (`packages/types/`)
- Shared TypeScript interfaces
- Type safety across apps
- No dependencies

#### Validation (`packages/validation/`)
- Zod schemas
- API request/response validation
- Form validation

## 📚 Documentation

- [Version Control Guide](VERSION_CONTROL_GUIDE.md) - Git workflow and conventions
- [Monorepo Version Control](MONOREPO_VERSION_CONTROL.md) - Monorepo-specific strategies
- [Git Quick Start](GIT_QUICKSTART.md) - Fast reference for common Git tasks
- [Architecture](ARCHITECTURE.md) - System design and decisions
- [Project Status](PROJECT_STATUS.md) - Current implementation status
- [Development Standards](CLAUDE.md) - Coding conventions and best practices
- [Mobile Testing Guide](apps/mobile/TESTING.md) - How to test the mobile app
- [ADRs](docs/adr/) - Architecture Decision Records

## 🔄 Version Control

This project uses Git with a **single-version monorepo strategy**:

```bash
# Initialize repository (first time)
git init && git branch -M main

# Create initial commit
git add .
git commit -m "chore: initial monorepo setup"

# Connect to remote
git remote add origin https://github.com/yourusername/lifters-club.git
git push -u origin main
```

### Branch Naming Convention

```
feature/<scope>/<name>    # feature/mobile/exercise-timer
fix/<scope>/<name>        # fix/server/auth-bug
refactor/<scope>/<name>   # refactor/engine/progression
docs/<name>               # docs/update-readme
```

### Commit Message Format

```
<type>(<scope>): <description>

- Bullet point 1
- Bullet point 2
```

**See [MONOREPO_VERSION_CONTROL.md](MONOREPO_VERSION_CONTROL.md) for complete guide.**

## 🚀 Deployment

### Mobile App
- iOS: Submit to App Store Connect
- Android: Submit to Google Play Console

### Backend API
- Deploy to Railway/Render/Fly.io
- Environment variables via platform
- PostgreSQL database connection

### Web Dashboard
- Deploy to Vercel
- Automatic deployments from `main` branch

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/mobile/your-feature`
2. Make changes and test: `pnpm test && pnpm typecheck && pnpm lint`
3. Commit with conventional format: `git commit -m "feat(mobile): your message"`
4. Push and create PR: `git push -u origin feature/mobile/your-feature`

## 📝 License

[Add your license here]

## 🙏 Acknowledgments

Built with:
- [Turborepo](https://turbo.build/) - Monorepo build system
- [pnpm](https://pnpm.io/) - Fast, disk space efficient package manager
- [Expo](https://expo.dev/) - React Native framework
- [Hono](https://hono.dev/) - Lightweight web framework
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [Clerk](https://clerk.com/) - Authentication and user management

Co-developed with [Claude Sonnet 4.5](https://www.anthropic.com/claude) by Anthropic.

---

**Ready to lift? 🏋️ Start with the [Quick Start](#-quick-start) guide above!**
