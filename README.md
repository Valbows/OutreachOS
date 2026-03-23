# OutreachOS

AI-powered email outreach, contact enrichment, and campaign analytics platform.

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4
- **Database:** Neon Postgres, Drizzle ORM
- **Auth:** Neon Auth (Better Auth) with OAuth
- **State:** TanStack Query v5, Zustand
- **Email:** Resend API
- **AI/LLM:** Gemini 2.5 Pro, OpenRouter
- **MCP Server:** HTTP+SSE & STDIO transports
- **CI/CD:** GitHub Actions → Vercel
- **Local Dev:** Docker Compose

## Project Structure

```
outreachos/
├── apps/
│   ├── web/           — Next.js frontend (port 3000)
│   └── mcp-server/    — MCP protocol server (port 3001)
├── packages/
│   ├── db/            — Drizzle schema + Neon client
│   ├── services/      — Business logic layer
│   ├── eslint-config/ — Shared ESLint config
│   └── typescript-config/ — Shared tsconfig
├── .github/workflows/ — CI + deploy pipelines
├── docker-compose.yml — Local dev environment
├── log.md             — Architecture decision log
└── .env.example       — Required environment variables
```

## Getting Started

```sh
# 1. Clone and install
pnpm install

# 2. Copy env and fill in values
cp .env.example .env

# 3. Dev (all packages)
pnpm dev

# 4. Or use Docker
docker compose up
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm type-check` | TypeScript check |
| `pnpm test:unit` | Run unit tests |
| `pnpm test:integration` | Run integration tests |
| `pnpm test:e2e` | Run E2E tests (Playwright) |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:push` | Push schema to database |
