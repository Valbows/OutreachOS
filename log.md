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
