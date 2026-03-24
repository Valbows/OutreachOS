# OutreachOS — Architecture Decision Log

## Phase 1 — Project Setup & Environment Foundation

### Date: 2026-03-23

### Decisions Made

1. **Monorepo Tool: Turborepo** — Selected for built-in caching, parallel task execution, and first-class pnpm support. `turbo.json` configured with 9 pipeline tasks: `build`, `dev`, `lint`, `type-check`, `test:unit`, `test:integration`, `test:e2e`, `db:generate`, `db:push`, `db:studio`.

2. **Package Manager: pnpm 9** — Strict dependency resolution, workspace protocol for internal packages. Three workspace packages: `@outreachos/db`, `@outreachos/services`, `@outreachos/mcp-server`.

3. **Next.js 16 (App Router)** — Latest stable with React 19, React Compiler, Tailwind CSS v4. Route groups: `(auth)` for login/signup, `(dashboard)` for protected app shell.

4. **Drizzle ORM + Neon Serverless** — Schema-first approach with full PRD data model (16 tables): accounts, contacts, contact_groups, contact_group_members, templates, campaigns, campaign_steps, message_instances, email_events, replies, experiments, experiment_batches, form_templates, form_submissions, linkedin_playbooks, llm_usage_log, api_keys, api_usage, blog_posts. Using `drizzle-orm/neon-http` driver for serverless compatibility.

5. **Design System: "Luminous Intelligence"** — Extracted from Stitch project theme. Dark-mode-only. Key rules:
   - No 1px borders — use background color shifts and negative space
   - No pure black — use navy substrate (#131318)
   - No standard drop shadows — use ambient glows
   - Ghost borders only for accessibility (outline-variant at 15% opacity)
   - Fonts: Inter (headlines/body), JetBrains Mono (technical/code)
   - CSS custom properties via Tailwind v4 `@theme` directive

6. **State Management** — TanStack Query v5 for server state (60s stale time, no refetch on window focus). Zustand for UI state (sidebar toggle, active account).

7. **CI/CD: GitHub Actions** — Two workflows:
   - `ci.yml`: PR gate → lint → type-check → unit → integration → E2E (Playwright)
   - `deploy.yml`: push to main → full CI suite → Vercel auto-deploy → smoke test

8. **Docker: Local dev** — `docker-compose.yml` with Postgres 16 Alpine (mirrors Neon), web dev server, MCP server. Volume mounts for hot reload.

9. **UI Primitives** — 6 base components: Button (4 variants), Card (with Header/Title/Content), Input (with label/error), Badge (5 variants), Modal (native dialog), Table (with Header/Body/Row/Head/Cell). All follow Luminous Intelligence design system.

### Open Questions
- Neon Auth is in Beta — monitoring for breaking changes
- Stitch design token extraction was manual from project theme JSON — may need refinement during Phase 2 screen conversion

## Full Test Workflow Audit — 2026-03-23

### Audit Scope
- User selected **audit only, no new tests**.
- Repository baseline reviewed: `d54c44b` (create-turbo scaffold), `d1721b1` (Phase 1 foundation), `fed6ea1` (validation cleanup).
- `main` and `dev` were aligned at `fed6ea1` during the audit.

### Current Validation Status
- `pnpm lint` — **passes**.
- `pnpm type-check` — **passes**.
- `pnpm build` — **passes**.
- `pnpm test:unit` — **fails**, because no test files exist for the configured Vitest-based package suites.
- `pnpm test:integration` — **passes as a placeholder**, but no package currently defines integration test tasks, so the command does not execute real integration coverage.
- `pnpm test:e2e` — **passes as a placeholder**, but no Playwright config or E2E spec files exist, so the command effectively validates build wiring only.

### Missing Test Infrastructure
- No discovered `*.test.*` or `*.spec.*` files anywhere in the workspace.
- No `vitest.config.*` present.
- No `playwright.config.*` present.
- No configured performance, security, architecture, or regression test harnesses were found.

### Safe Cleanup Candidates (Not Removed)
- `apps/web/README.md` — stale `create-next-app` boilerplate and no longer accurate for OutreachOS.
- `apps/web/public/file.svg` — unreferenced default asset.
- `apps/web/public/globe.svg` — unreferenced default asset.
- `apps/web/public/next.svg` — unreferenced default asset.
- `apps/web/public/vercel.svg` — unreferenced default asset.
- `apps/web/public/window.svg` — unreferenced default asset.

### Recommended Next Steps
- Add Vitest configuration and package-local unit tests for `@outreachos/db`, `@outreachos/services`, and `@outreachos/mcp-server`.
- Add Playwright config and a minimal authenticated shell smoke test for `apps/web`.
- Add at least one real integration suite for DB/schema validation so `pnpm test:integration` exercises actual boundaries instead of task wiring.

## Unit Test Creation Workflow — 2026-03-23

### Scope
- User requested unit tests only for **currently implemented code**, without inventing behavior for later implementation phases.
- Web test dependencies were explicitly approved so the existing `apps/web` code could be covered fully.

### Test Infrastructure Added
- Added package-local `vitest.config.ts` files for:
  - `packages/db`
  - `packages/services`
  - `apps/mcp-server`
  - `apps/web`
- Added `apps/web/src/test/setup.ts` for DOM test setup and cleanup.
- Added `test:unit` script to `apps/web/package.json`.
- Added root coverage provider dependency: `@vitest/coverage-v8`.
- Added web unit-test dependencies: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.

### Test Suites Added
- `packages/db/src/index.test.ts`
  - Covers Drizzle client initialization.
  - Covers schema barrel exports.
  - Covers table names, critical columns, and all currently implemented relation callbacks.
- `packages/services/src/index.test.ts`
  - Covers current service stub exports and instantiation.
- `apps/mcp-server/src/entrypoints.test.ts`
  - Covers HTTP and STDIO placeholder startup behavior, including default and configured port handling.
- `apps/web/src/lib/store.test.ts`
  - Covers Zustand state initialization and state transitions.
- `apps/web/src/lib/query-provider.test.tsx`
  - Covers React Query provider defaults and child rendering.
- `apps/web/src/components/ui/ui.test.tsx`
  - Covers Button, Card, Badge, Input, Modal, and Table primitives.
- `apps/web/src/components/ui/modal-null-ref.test.tsx`
  - Covers the Modal null-ref early-return branch.
- `apps/web/src/app/app.test.tsx`
  - Covers current app layouts, placeholder pages, metadata, and redirect behavior.

### Final Validation Status
- `pnpm lint` — **passes**.
- `pnpm type-check` — **passes**.
- `pnpm test:unit` — **passes**.

### Coverage Result
- `@outreachos/db` — **100% statements / 100% branches / 100% lines** on currently implemented source.
- `@outreachos/services` — **100% statements / 100% branches / 100% lines** on currently implemented source.
- `@outreachos/mcp-server` — **100% statements / 100% branches / 100% lines** on currently implemented source.
- `@outreachos/web` — **100% statements / 100% branches / 100% lines** on currently implemented source.

## Full Codebase Review — 2026-03-23

### Scope
- Comprehensive scan of all production source files, configs, Dockerfiles, and CI workflows.
- Review identified 8 bugs across the codebase.

### Bug Fixes Applied

| # | Severity | Category | Issue | Fix |
|---|----------|----------|-------|-----|
| 1 | **High** | Navigation | Route group paths used as URLs in `page.tsx` and `layout.tsx` | Changed `redirect("/(dashboard)")` to `redirect("/")` and removed route group prefix from all NavItem hrefs. Updated corresponding tests. |
| 2 | **Medium** | Schema | `updatedAt` columns use `defaultNow()` which doesn't auto-update for direct SQL clients | Removed `.$onUpdate()` from all schemas; created PostgreSQL trigger function `update_updated_at_column()` and applied BEFORE UPDATE triggers to all 8 tables (`accounts`, `contacts`, `templates`, `campaigns`, `experiments`, `linkedin_playbooks`, `blog_posts`, `form_templates`) for DB-level consistency across all clients. Migration: `migrations/0000_add_updated_at_triggers.sql`. |
| 3 | **Low** | Schema | `imapPort` and `smtpPort` stored as `text` | Changed to `integer` type in `accounts.ts` table definition. Added `integer` import. |
| 4 | **Medium** | Runtime | `DATABASE_URL` non-null assertion without validation | Added explicit check with clear error message: `throw new Error("DATABASE_URL environment variable is required but not set.")`. |
| 5 | **High** | Docker | Web Dockerfile copies `.next/standalone` but `output: standalone` not configured | Added `output: "standalone"` to `next.config.ts`. |
| 6 | **Medium** | Schema | `contactGroupMembers` missing unique constraint | Added composite `unique().on(table.contactId, table.groupId)` constraint to prevent duplicate memberships. |
| 7 | **Low** | Config | `docker-compose.yml` uses deprecated `version` key | Removed `version: "3.9"` line. |
| 8 | **Medium** | Docker | MCP server Dockerfile copies entire monorepo `node_modules` | Added `pnpm prune --prod --no-optional` in builder stage, restructured runner stage to copy workspace package `package.json`, `dist/`, and `node_modules` with proper WORKDIR. |
| 9 | **Medium** | Package | `exports` map `types` condition order in workspace packages | Reordered so `types` appears before `import` and `default` per TypeScript condition precedence in `packages/db/package.json` and `packages/services/package.json`. |
| 10 | **Low** | Docker | MCP server Dockerfile missing HEALTHCHECK | Added HEALTHCHECK with Node.js HTTP probe against `localhost:3001/health` with 30s interval, 5s timeout, 10s start-period, 3 retries. |
| 11 | **Medium** | Web | NavItem uses plain `<a>` causing full page reloads | Changed to Next.js `Link` component for client-side navigation with prefetching. |
| 12 | **Low** | Test | DB test missing relation property assertions | Added `expect(dbModule.XXXRelations).toBeDefined()` for 11 additional relations before their `.config()` calls for clearer failure diagnostics. |

### Additional Fixes (Full Test Suite Workflow)
- **MCP Server Dockerfile Runner Stage** — Restructured COPY steps to include:
  - Root `package.json` + `pnpm-workspace.yaml` for pnpm virtual store
  - `apps/mcp-server/package.json` + `dist/` + `node_modules/`
  - `packages/db/package.json` + `dist/`
  - `packages/services/package.json` + `dist/`
  - Root `node_modules/` for npm dependencies
  - Changed `WORKDIR` to `/app/apps/mcp-server` for correct relative paths
- **Workspace Package Entry Points** — Updated `main` and `types` to point to `dist/` outputs with proper `exports` map for Node.js ESM resolution.

### Final Validation
- `pnpm lint` — **passes**.
- `pnpm type-check` — **passes**.
- `pnpm test:unit` — **passes** (23 tests across 4 packages).
