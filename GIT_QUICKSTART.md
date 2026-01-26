# Git Quick Start Guide

Fast reference for common Git operations in the Lifters Club monorepo.

## 🚀 Initialize Repository (First Time Only)

```bash
# Navigate to project root
cd /Users/oluwatosinfamurewa/Projects/lifters-club

# Initialize git
git init && git branch -M main

# Add all files
git add .

# Create initial commit
git commit -m "chore: initial monorepo setup with Exercise Substitution Flow MVP"

# Connect to GitHub (create repo on GitHub first)
git remote add origin https://github.com/yourusername/lifters-club.git

# Push to remote
git push -u origin main
```

✅ **Done! Your repository is now version controlled.**

---

## 📋 Daily Workflow

### 1. Start New Feature

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/mobile/your-feature-name
```

### 2. Make Changes

```bash
# Work on your feature...
# Edit files in apps/mobile, packages/types, etc.

# Check what changed
git status
git diff
```

### 3. Test Your Changes

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build
pnpm build
```

### 4. Commit Changes

```bash
# Stage specific files
git add apps/mobile/components/NewComponent.tsx
git add packages/types/src/exercise.ts

# Or stage all changes
git add .

# Commit with message
git commit -m "feat(mobile): add new feature

- Implement NewComponent
- Update types
- Add tests"
```

### 5. Push to Remote

```bash
# First push of new branch
git push -u origin feature/mobile/your-feature-name

# Subsequent pushes
git push
```

### 6. Create Pull Request

Go to GitHub → Create Pull Request → Merge when approved

---

## 🔧 Common Commands

### Check Status

```bash
git status           # See what changed
git diff             # See changes in detail
git log --oneline    # View commit history
```

### Branching

```bash
git branch                      # List branches
git checkout branch-name        # Switch branch
git checkout -b new-branch      # Create and switch
git branch -d branch-name       # Delete local branch
```

### Updating Code

```bash
git pull origin main            # Update from remote
git fetch origin                # Download latest changes
git merge origin/main           # Merge remote changes
```

### Undoing Changes

```bash
git checkout -- file.txt        # Discard changes to file
git reset HEAD file.txt         # Unstage file
git reset --soft HEAD~1         # Undo last commit (keep changes)
```

---

## 💡 Quick Examples

### Example 1: Add New Component to Mobile App

```bash
# Create feature branch
git checkout -b feature/mobile/exercise-timer

# Create and test component
# ... work work work ...

# Stage and commit
git add apps/mobile/components/ExerciseTimer.tsx
git add apps/mobile/components/__tests__/ExerciseTimer.test.tsx
git commit -m "feat(mobile): add exercise timer component"

# Push
git push -u origin feature/mobile/exercise-timer
```

### Example 2: Update Shared Types

```bash
# Create branch
git checkout -b feature/types/workout-status

# Update type in packages/types
# Update consuming apps (mobile, server)
pnpm build && pnpm test

# Commit all together
git add packages/types/src/workout.ts
git add apps/mobile/hooks/use-workout.ts
git add apps/server/src/routes/workouts.ts
git commit -m "feat(types,mobile,server): add workout status field"

# Push
git push -u origin feature/types/workout-status
```

### Example 3: Fix Bug

```bash
# Create fix branch
git checkout -b fix/mobile/offline-sync

# Fix bug and add test
# ... fix fix fix ...

# Commit
git add apps/mobile/lib/offline/queue.ts
git add apps/mobile/lib/offline/__tests__/queue.test.ts
git commit -m "fix(mobile): prevent race condition in offline sync"

# Push
git push -u origin fix/mobile/offline-sync
```

---

## 🎯 Commit Message Templates

### New Feature

```bash
git commit -m "feat(scope): short description

- Bullet point 1
- Bullet point 2
- Bullet point 3"
```

### Bug Fix

```bash
git commit -m "fix(scope): short description

- What was wrong
- How it's fixed
- Test coverage added"
```

### Refactoring

```bash
git commit -m "refactor(scope): short description

- What was refactored
- Why it's better
- No behavior changes"
```

### Multiple Packages

```bash
git commit -m "feat(types,mobile,server): short description

- types: what changed
- mobile: what changed
- server: what changed"
```

---

## ⚡ Before Every Commit

Run this checklist:

```bash
pnpm build      # ✅ Everything builds
pnpm typecheck  # ✅ No type errors
pnpm lint       # ✅ Code style correct
pnpm test       # ✅ All tests pass
```

Then commit:

```bash
git add .
git commit -m "your message"
git push
```

---

## 🆘 Emergency: Undo Last Commit

```bash
# Undo commit but keep changes
git reset --soft HEAD~1

# Undo commit and discard changes (DANGEROUS!)
git reset --hard HEAD~1
```

---

## 📚 Full Documentation

- **Detailed Git Guide**: [VERSION_CONTROL_GUIDE.md](VERSION_CONTROL_GUIDE.md)
- **Monorepo Strategy**: [MONOREPO_VERSION_CONTROL.md](MONOREPO_VERSION_CONTROL.md)
- **Testing Guide**: [apps/mobile/TESTING.md](apps/mobile/TESTING.md)

---

## 🎓 Remember

1. ✅ Always work on a feature branch
2. ✅ Test before committing
3. ✅ Write clear commit messages
4. ✅ Commit related changes together
5. ✅ Push regularly to backup work

**Happy coding! 🚀**
