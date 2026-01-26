# Monorepo Version Control Strategy

Complete guide for version controlling the Lifters Club monorepo with Turborepo + pnpm workspaces.

## 📦 Monorepo Structure

```
lifters-club/
├── apps/
│   ├── mobile/          # React Native + Expo app
│   ├── server/          # Hono backend API
│   └── web/             # Next.js admin dashboard
├── packages/
│   ├── db/              # Drizzle ORM + schemas (shared)
│   ├── engine/          # Decision engine logic (shared)
│   ├── types/           # TypeScript types (shared)
│   └── validation/      # Zod schemas (shared)
├── docs/adr/            # Architecture Decision Records
├── scripts/             # Utility scripts
├── package.json         # Root package (orchestration)
├── pnpm-workspace.yaml  # Workspace configuration
├── turbo.json           # Turborepo task configuration
└── .gitignore           # What NOT to commit
```

## 🎯 Version Control Strategy

### Single Repository, Unified Versioning

This monorepo uses a **single-version strategy** where all packages and apps are versioned together:

- ✅ **One commit affects the whole monorepo** - simplifies history
- ✅ **All packages stay in sync** - no version mismatch issues
- ✅ **Atomic changes** - change API + client in one commit
- ✅ **Simplified CI/CD** - test everything together

### Alternative: Independent Versioning

(Not currently used, but possible if needed)
- Each package has its own version number
- Useful for public npm packages
- More complex to manage

## 🚀 Getting Started

### 1. Initialize Git Repository

```bash
# From project root
cd /Users/oluwatosinfamurewa/Projects/lifters-club

# Initialize git
git init

# Set default branch
git branch -M main

# Configure git user
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 2. Initial Commit

```bash
# Add all files (respects .gitignore)
git add .

# Create initial commit
git commit -m "chore: initial monorepo setup with Exercise Substitution Flow

## Project Structure
- Turborepo + pnpm workspaces monorepo
- 3 apps: mobile (Expo), server (Hono), web (Next.js)
- 4 shared packages: db, engine, types, validation

## Features Implemented
- Exercise Substitution Flow (mobile)
  - Alternative exercises screen with match scores
  - Exercise Actions Sheet (Info, Alternatives, Skip, Mark Done)
  - Workout completion UNDO functionality
  - 52 unit tests with 90%+ coverage
- Offline-first architecture with AsyncStorage
- Type-safe with strict TypeScript across all packages

## Tech Stack
- Backend: Hono, Drizzle ORM, PostgreSQL
- Frontend: React Native (Expo), Next.js 15
- Auth: Clerk
- Validation: Zod
- Testing: Jest (mobile), Vitest (server/packages)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 3. Connect to Remote

```bash
# Add remote repository
git remote add origin https://github.com/yourusername/lifters-club.git

# Push to remote
git push -u origin main
```

## 🌿 Branching Strategy for Monorepos

### Branch Naming with Scope

Include the affected app/package in branch name:

```bash
# Feature branches
feature/mobile/exercise-substitution
feature/server/exercise-api
feature/web/admin-dashboard

# Multi-package changes
feature/shared/offline-queue
feature/types/exercise-preferences

# Cross-cutting changes
feature/full-stack/user-authentication

# Bug fixes
fix/mobile/offline-sync
fix/server/api-rate-limiting

# Refactoring
refactor/engine/progression-calculation
refactor/db/schema-optimization
```

### Workflow Example

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/mobile/exercise-info-modal

# 3. Make changes to multiple packages
# Edit: apps/mobile/components/ExerciseInfoModal.tsx
# Edit: packages/types/src/exercise.ts
# Edit: apps/mobile/components/__tests__/ExerciseInfoModal.test.tsx

# 4. Test affected packages
pnpm test --filter @gymapp/mobile
pnpm test --filter @gymapp/types

# 5. Stage and commit
git add apps/mobile/components/ExerciseInfoModal.tsx
git add packages/types/src/exercise.ts
git add apps/mobile/components/__tests__/ExerciseInfoModal.test.tsx

git commit -m "feat(mobile): add exercise info modal

- Implement ExerciseInfoModal component
- Add ExerciseInfo type to shared types package
- Include 15 unit tests
- Display instructions, safety tips, and tempo

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# 6. Push and create PR
git push -u origin feature/mobile/exercise-info-modal
```

## 📝 Commit Message Convention

### Format for Monorepo Commits

```
<type>(<scope>): <description>

[optional body with bullet points]

[optional footer]
```

### Scopes for Monorepo

| Scope | Usage | Example |
|-------|-------|---------|
| `mobile` | Mobile app changes | `feat(mobile): add dark mode` |
| `server` | Backend API changes | `fix(server): handle CORS` |
| `web` | Web dashboard changes | `feat(web): add analytics` |
| `db` | Database/schema changes | `refactor(db): optimize queries` |
| `engine` | Decision engine logic | `feat(engine): add volume calc` |
| `types` | Shared types | `feat(types): add WorkoutLog` |
| `validation` | Zod schemas | `fix(validation): email regex` |
| `monorepo` | Build/tooling | `chore(monorepo): update turbo` |
| `ci` | CI/CD pipeline | `chore(ci): add test workflow` |

### Multi-Package Commits

When changes affect multiple packages:

```bash
git commit -m "feat(types,mobile,server): add exercise preference storage

Changes:
- types: Add ExercisePreference interface
- mobile: Implement preference storage UI
- server: Add preference API endpoints

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## 🏗️ Managing Shared Packages

### Understanding Dependencies

```json
{
  "name": "@gymapp/mobile",
  "dependencies": {
    "@gymapp/types": "workspace:*",     // ← Local package
    "@gymapp/validation": "workspace:*", // ← Local package
    "react": "19.1.0"                    // ← External package
  }
}
```

### When Changing Shared Packages

**Example: Adding a field to `@gymapp/types`**

1. **Update the shared package:**
   ```typescript
   // packages/types/src/exercise.ts
   export interface ExercisePreference {
     originalId: string;
     substituteId: string;
     timestamp: string;
     reason?: string;        // ← NEW FIELD
     createdAt?: Date;       // ← NEW FIELD
   }
   ```

2. **Rebuild the package:**
   ```bash
   pnpm --filter @gymapp/types build
   ```

3. **Update consuming apps:**
   ```typescript
   // apps/mobile/lib/offline/storage.ts
   await offlineStorage.storeExercisePreference({
     originalId: "bench-press",
     substituteId: "incline-bench",
     timestamp: new Date().toISOString(),
     reason: "User selected",
     createdAt: new Date(),  // ← USE NEW FIELD
   });
   ```

4. **Commit everything together:**
   ```bash
   git add packages/types/src/exercise.ts
   git add apps/mobile/lib/offline/storage.ts

   git commit -m "feat(types,mobile): add createdAt to ExercisePreference

   - Add createdAt field to ExercisePreference interface
   - Update mobile storage to include timestamp
   - Maintain backward compatibility with optional field"
   ```

### Breaking Changes in Shared Packages

**When a change breaks consuming apps:**

```bash
# Example: Renaming a type field
# packages/types/src/exercise.ts
export interface Exercise {
  id: string;
  name: string;
  muscleGroups: string[];  // ← WAS: primaryMuscles
}

# Must update ALL consuming apps in the same commit
# apps/mobile/...
# apps/server/...
# apps/web/...

git commit -m "refactor(types,mobile,server,web): rename primaryMuscles to muscleGroups

BREAKING CHANGE: Exercise.primaryMuscles renamed to Exercise.muscleGroups

- Update type definition
- Update all consuming apps
- Update tests
- Update documentation"
```

## 🔄 Turborepo Build Pipeline

### How Turborepo Manages Dependencies

Turborepo automatically builds packages in the correct order:

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],  // ← Build dependencies first
      "outputs": ["dist/**"]
    }
  }
}
```

**Build Order:**
1. `@gymapp/types` (no dependencies)
2. `@gymapp/validation` (depends on types)
3. `@gymapp/db` (depends on types)
4. `@gymapp/engine` (depends on types)
5. `@gymapp/server` (depends on db, validation, types)
6. `@gymapp/mobile` (depends on types, validation)
7. `@gymapp/web` (depends on types, validation)

### Testing Changes Across Packages

```bash
# Test everything
pnpm test

# Test specific package and its dependencies
pnpm test --filter @gymapp/mobile...

# Test package and its dependents
pnpm test --filter ...@gymapp/types
```

## 🚦 CI/CD for Monorepos

### GitHub Actions Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm build

      - name: Type check all packages
        run: pnpm typecheck

      - name: Lint all packages
        run: pnpm lint

      - name: Run all tests
        run: pnpm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/lifters_test

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./apps/mobile/coverage/lcov.info,./apps/server/coverage/lcov.info
```

### Optimizing CI with Turborepo Cache

```yaml
- name: Setup Turborepo cache
  uses: actions/cache@v3
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-

- name: Build (with cache)
  run: pnpm build

- name: Test (with cache)
  run: pnpm test
```

### Affected Package Detection

Only test changed packages:

```bash
# Detect which packages changed
pnpm turbo run test --filter="[HEAD^1]"

# Or use a GitHub Action
- uses: nrwl/nx-set-shas@v3
- run: pnpm turbo run test --filter="...[origin/main]"
```

## 📦 Release Strategy

### Option 1: Manual Releases (Current)

```bash
# 1. Update version in root package.json
# 2. Tag the release
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# 3. Deploy
# Mobile: Submit to app stores
# Server: Deploy to production
# Web: Deploy to Vercel/hosting
```

### Option 2: Automated with Changesets

Install changesets:

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

**Workflow:**

```bash
# 1. Create changeset for your changes
pnpm changeset

# Follow prompts:
# - Select changed packages
# - Describe changes
# - Choose version bump (patch/minor/major)

# 2. Commit changeset
git add .changeset/
git commit -m "chore: add changeset"

# 3. On release:
pnpm changeset version  # Updates package.json versions
pnpm changeset publish  # Publishes (if packages are public)
```

## 📊 Tracking Changes Across Packages

### Using Git Log for Monorepos

```bash
# See all changes
git log --oneline

# Changes to specific package
git log --oneline -- packages/types/

# Changes affecting mobile app
git log --oneline -- apps/mobile/

# Changes to shared packages
git log --oneline -- packages/
```

### Viewing Cross-Package Changes

```bash
# Show files changed in last commit
git show --name-only

# Show all files changed in feature branch
git diff main...feature/mobile/exercise-info --name-only

# See which packages were affected
git diff main...feature/mobile/exercise-info --name-only | cut -d'/' -f1-2 | sort -u
```

## 🔍 Best Practices for Monorepo Commits

### ✅ DO

1. **Commit related changes together:**
   ```bash
   # Good - atomic change across packages
   git add packages/types/src/exercise.ts
   git add apps/mobile/components/ExerciseCard.tsx
   git commit -m "feat(types,mobile): add difficulty field"
   ```

2. **Test before committing:**
   ```bash
   pnpm build
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

3. **Keep commits focused:**
   ```bash
   # Good - single feature
   git commit -m "feat(mobile): add exercise info modal"

   # Bad - mixing features
   git commit -m "add exercise info, fix bugs, refactor storage"
   ```

4. **Use meaningful commit messages:**
   ```bash
   # Good
   git commit -m "feat(mobile): add exercise substitution with 24h cache"

   # Bad
   git commit -m "updates"
   ```

### ❌ DON'T

1. **Don't commit broken builds:**
   ```bash
   # Always ensure this passes:
   pnpm build
   ```

2. **Don't commit half-finished features:**
   ```bash
   # Use draft branches instead
   git checkout -b draft/feature-name
   ```

3. **Don't mix refactoring with features:**
   ```bash
   # Bad - two unrelated changes
   git commit -m "add feature X and refactor Y"

   # Good - separate commits
   git commit -m "refactor(engine): extract volume calculation"
   git commit -m "feat(mobile): add volume tracking UI"
   ```

4. **Don't commit generated files:**
   ```bash
   # Already in .gitignore:
   # - dist/
   # - .next/
   # - node_modules/
   # - coverage/
   ```

## 🛠️ Useful Monorepo Commands

### Development

```bash
# Install all dependencies
pnpm install

# Run dev server for specific app
pnpm --filter @gymapp/mobile dev
pnpm --filter @gymapp/server dev
pnpm --filter @gymapp/web dev

# Run all dev servers concurrently
pnpm dev

# Build all packages
pnpm build

# Build specific package and its dependencies
pnpm --filter @gymapp/mobile build
```

### Testing

```bash
# Test all packages
pnpm test

# Test specific package
pnpm --filter @gymapp/mobile test

# Test with coverage
pnpm test:coverage

# Watch mode
pnpm --filter @gymapp/mobile test:watch
```

### Cleaning

```bash
# Clean build outputs
pnpm clean

# Remove node_modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules

# Fresh install
pnpm install
```

## 📋 Pre-Commit Checklist

Before committing to the monorepo:

- [ ] ✅ All changed packages build successfully: `pnpm build`
- [ ] ✅ Type checking passes: `pnpm typecheck`
- [ ] ✅ Linting passes: `pnpm lint`
- [ ] ✅ All tests pass: `pnpm test`
- [ ] ✅ Commit message follows convention
- [ ] ✅ No `console.log` or debug code left
- [ ] ✅ Updated tests for new features
- [ ] ✅ No sensitive data (API keys, credentials)

### Optional: Git Hooks

Install husky for automated checks:

```bash
pnpm add -D husky lint-staged
pnpm exec husky init

# .husky/pre-commit
pnpm typecheck
pnpm lint
pnpm test
```

## 🎯 Summary

**Key Takeaways:**

1. **Single Repository** - All apps and packages in one repo
2. **Unified Versioning** - All packages versioned together
3. **Atomic Commits** - Change multiple packages in one commit
4. **Turborepo Orchestration** - Automatic build order management
5. **pnpm Workspaces** - Efficient dependency management
6. **Clear Scopes** - Use `(mobile)`, `(server)`, `(types)` in commits
7. **Test Everything** - CI runs tests for all packages
8. **Shared Packages** - Keep breaking changes in sync

**Next Steps:**

1. Initialize git: `git init && git branch -M main`
2. Make initial commit (see above)
3. Connect to remote repository
4. Set up CI/CD workflows
5. Start using feature branches for new work

For general Git commands and workflows, see [VERSION_CONTROL_GUIDE.md](VERSION_CONTROL_GUIDE.md).
