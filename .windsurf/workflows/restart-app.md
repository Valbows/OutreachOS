---
description: Full application restart protocol for OutreachOS
---

# OutreachOS Application Restart Protocol

## Architecture Overview
- **Web App**: Next.js 16 on port 3000 (`apps/web/`)
- **MCP Server**: Protocol server on port 3001 (`apps/mcp-server/`)
- **Database**: Postgres via Docker Compose or Neon cloud
- **Monorepo**: Turborepo + pnpm workspaces

## Full Restart Protocol

### 1. Kill Existing Servers (Critical)
```bash
# Find and kill any Node processes on app ports (POSIX-safe for macOS)
pids="$(lsof -t -i:3000,3001 2>/dev/null)"
[ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null

# Alternative: Kill all node processes for this project (POSIX-safe)
pids="$(ps aux | grep -E '(next|turbo)' | grep -v grep | awk '{print $2}')"
[ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null
```

### 2. Clean State (Optional but Recommended)
```bash
# Run from project root (where package.json is located)

# Clean Next.js cache
rm -rf apps/web/.next
rm -rf apps/mcp-server/.next
rm -rf node_modules/.cache

# Reinstall dependencies (if needed)
pnpm install
```

### 3. Restart Options

#### Option A: Docker Compose (Full Stack - Recommended for Manual Testing)
```bash
# Run from project root

# Stop containers (RECOMMENDED: preserves database and volumes)
docker compose down

# Alternative: Stop and REMOVE volumes (DESTRUCTIVE - permanently deletes all database data!)
# WARNING: `docker compose down -v` will remove volumes and permanently delete database and persisted data.
# Only use -v if you want a completely fresh start with no existing data.
# docker compose down -v

# Start fresh with database + servers
docker compose up -d --build

# View logs
docker compose logs -f
```

#### Option B: Turborepo Dev (Native - Faster)
```bash
# Run from project root

# Ensure database is running (Docker)
docker compose up -d postgres

# Start all dev servers
pnpm dev
```

#### Option C: Individual Services (Terminal Windows)
```bash
# Terminal 1: Database
docker compose up -d postgres

# Terminal 2: Web App
cd apps/web && pnpm dev

# Terminal 3: MCP Server  
cd apps/mcp-server && pnpm dev
```

### 4. Verification
```bash
# Check services are running
curl http://localhost:3000/api/health || echo "Web not ready"
curl http://localhost:3001/health || echo "MCP not ready"

# Check Docker containers
docker compose ps
```

### 5. URLs After Restart
| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| MCP Server | http://localhost:3001 |
| Database | localhost:5432 |

## Troubleshooting

### Port Already in Use
```bash
lsof -i :3000  # Find process
kill -9 <PID>  # Kill it
```

### Database Connection Issues
```bash
# Reset database container (stop, remove with volumes, then recreate)
docker compose stop postgres
docker compose rm -v postgres
docker compose up -d postgres

# Alternative: Reset ALL services and their volumes (DESTRUCTIVE)
# docker compose down -v
docker compose up -d

# Push schema
pnpm db:push
```

### Cache Issues
```bash
# Clear all caches
rm -rf node_modules/.cache
rm -rf apps/web/.next
rm -rf apps/mcp-server/.next
pnpm install
```

## Quick One-Liner Restart (Run pnpm install separately if needed)
```bash
# Kill servers, reset Docker state, start fresh (pnpm dev is separate)
# Run from project root:
pids="$(lsof -t -i:3000,3001 2>/dev/null)" && [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null; docker compose down -v; docker compose up -d --build

# Then in a separate terminal (from project root):
pnpm dev
```
