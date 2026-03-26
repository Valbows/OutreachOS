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

## Phase 2 — Authentication & Access Control

### Date: 2026-03-24

### Decisions Made

1. **Auth Provider: Neon Auth (`@neondatabase/auth@0.2.0-beta.1`)** — Built on Better Auth. Single `createNeonAuth` instance provides `.handler()`, `.middleware()`, `.getSession()`, and sign-in/sign-up methods. Chosen for native Neon DB integration and zero-config session management.

2. **Auth Architecture: Server/Client Split** — `lib/auth/server.ts` creates the Neon Auth instance (server-only, uses `next/headers`). `lib/auth/client.ts` creates a browser-side `authClient` for OAuth social sign-in flows. Barrel re-export in `lib/auth/index.ts`.

3. **API Route: Catch-all handler** — `app/api/auth/[...path]/route.ts` proxies all auth API requests through `auth.handler()`. Exports `GET` and `POST`.

4. **Middleware: Route Protection** — `middleware.ts` at `apps/web` root uses `auth.middleware()` with `loginUrl: "/login"`. Protects all dashboard routes: `/contacts`, `/campaigns`, `/templates`, `/forms`, `/analytics`, `/settings`, `/developer`.

5. **Server Actions: Form-based Auth** — `signInWithEmail` and `signUpWithEmail` as `"use server"` actions in route-local `actions.ts` files. Use `useActionState` (React 19) for pending/error state management. Redirect to `/` on success.

6. **OAuth Providers: Google + GitHub** — Social sign-in via `authClient.signIn.social()`. Provider buttons on both login and signup pages. Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` env vars (already in `.env.example`).

7. **Stitch Screen Conversions (3 of 3 complete):**
   - **Login/Signup (#1)** — Split-screen layout. Left: branding panel with gradient hero. Right: form panel. OAuth buttons, email/password form, error display, pending state, cross-linking.
   - **Dashboard Overview (#2)** — Sidebar (collapsible via Zustand `sidebarOpen`), TopBar with hamburger toggle, 4-stat grid, Active Campaigns list, Inbox Health metrics, Recent Activity feed, Experiment Progress bar.
   - **Account Settings (#12)** — Tabbed layout (Profile, Inbox Connection, Notifications, Danger Zone). Profile: avatar upload, name/email/company, password change. Inbox: IMAP/SMTP config, Google OAuth sync, LLM provider select, sender domain, BYOK key management (Hunter.io, Resend, Gemini, OpenRouter). Notifications: toggle rows. Danger: data export, account deletion.

8. **Dashboard Shell Components:**
   - `components/layouts/sidebar.tsx` — Client component. 8 main nav items with Material-style SVG icons, active state highlighting via `usePathname()`, collapsible width (64→256px), bottom nav with Settings + Log out.
   - `components/layouts/top-bar.tsx` — Client component. Hamburger button toggles sidebar via Zustand store.
   - Barrel export: `components/layouts/index.ts`.

9. **Badge Component Extended** — Added `"secondary"` variant (`bg-surface-container-highest text-on-surface-variant`) for campaign status badges and neutral tags.

### Test Suites Added (Phase 2)
- `src/lib/auth/auth.test.ts` — 4 tests: server instance creation with env vars, auth exports, client creation, barrel re-export.
- `src/app/(auth)/login/login.test.tsx` — 3 tests: full form rendering, error state, pending state.
- `src/app/(auth)/signup/signup.test.tsx` — 3 tests: full form rendering, error state, pending state.
- `src/app/(dashboard)/dashboard.test.tsx` — 6 tests: greeting, stats, campaigns, inbox health, activity, experiment.
- `src/app/(dashboard)/settings/settings.test.tsx` — 6 tests: heading, tab buttons, profile default, inbox tab, notifications tab, danger zone tab.
- `src/components/layouts/sidebar.test.tsx` — 3 tests: nav items, active highlighting, logout click.
- `src/app/app.test.tsx` — Updated with auth mocks and new assertions for Phase 2 page content.

### Final Validation
- `pnpm type-check` — **passes**.
- `pnpm vitest run` — **passes** (43 tests across 11 files, 0 failures).

### Open Questions
- Neon Auth is in beta (`0.2.0-beta.1`) — peer dependency warnings for `@better-auth/passkey` version mismatch (expects 1.5.6, got 1.4.6). Non-blocking.
- IMAP/SMTP settings, BYOK key management, and LLM preference are UI-only scaffolds — backend integration deferred to Phase 3+ server actions.
- OAuth provider configuration (Google/GitHub) requires Neon Console setup and env var population before live testing.

## Phase 2 Accessibility Enhancements — 2026-03-24

### Date: 2026-03-24

### Scope
Comprehensive accessibility audit and fixes across all Phase 2 UI components to ensure WCAG 2.1 AA compliance and robust screen reader support.

### Changes Implemented

1. **Switch Component Accessibility (`components/ui/switch.tsx`)**
   - Added `role="switch"` to input element for proper assistive tech semantics
   - Added `aria-checked={checked}` to mirror checked state for screen readers
   - Moved `className` prop from track `<div>` to root `<label>` for consistent consumer styling
   - Added regression tests in `ui.test.tsx` for switch semantics and className behavior

2. **Select Component Label Association (`components/ui/select.tsx`)**
   - Implemented `useId()` for stable generated IDs
   - Wired `htmlFor` on label and `id` on select for programmatic association
   - Support for explicit `id` prop override
   - Added regression test for both generated and explicit ID scenarios

3. **Sidebar Navigation Enhancements (`components/layouts/sidebar.tsx`)**
   - Added `aria-label="Main navigation"` to sidebar `<aside>` element
   - Added `aria-hidden="true"` to all decorative navigation SVG icons
   - Added `data-active` attribute to nav links for stable test assertions
   - Improved logo accessibility: `sr-only` text "OutreachOS" when collapsed, decorative "O" with `aria-hidden="true"`
   - Added `aria-label` to collapsed nav links for screen reader context
   - Implemented sign-out error handling with inline `role="alert"` message
   - Added collapsed-mode loading feedback: spinner icon + `aria-busy` + accessible name during sign-out
   - Ensured consistent icon sizing via parent wrapper classes

4. **Dashboard Page Improvements (`app/(dashboard)/page.tsx`)**
   - Added `"use client"` directive for `useSession()` hook compatibility
   - Implemented time-aware greeting helper (`getGreeting()`) based on hour of day
   - Made dashboard greeting dynamic using `authClient.useSession()` for personalized user name

5. **Auth Pages Enhancements**
   - **Login/Signup OAuth Flow (`app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`)**
     - Wrapped OAuth sign-in calls with async handlers for proper loading/error states
     - Added `role="alert"` to OAuth error messages
     - Implemented cross-blocking: OAuth pending disables email submit, email pending disables OAuth buttons
     - Fixed OAuth pending state: only clears on failure (not on successful redirect) to prevent UI flicker
     - Initially added a `finally` block for unconditional pending state cleanup (always clears regardless of outcome)
   - **Server Actions (`app/(auth)/login/actions.ts`, `app/(auth)/signup/actions.ts`)**
     - Sanitized error logging to avoid logging full error objects or PII
     - Secured error messages with generic user-facing text
     - Null-safe form data extraction

6. **Settings Page Accessibility (`app/(dashboard)/settings/page.tsx`)**
   - Replaced native checkbox inputs with custom `Switch` component for consistent UI
   - Replaced native `<select>` with custom `Select` component for design system compliance
   - Added `aria-hidden="true"` to all decorative SVG icons (ProfileIcon, InboxIcon, NotificationsIcon, DangerIcon, GoogleIcon)

7. **Test Infrastructure Improvements**
   - Added `vi.resetModules()` to signup test `beforeEach` for consistent module isolation
   - Improved test isolation with `vi.clearAllMocks()` and environment cleanup in auth tests
   - Made dashboard greeting test deterministic using `vi.useFakeTimers()` and `vi.setSystemTime()`
   - Updated app integration test to accept flexible time-aware greetings
   - Added Zustand store reset in sidebar tests for clean state between runs
   - Extended signup tests to verify cross-blocking between OAuth and email auth pending states
   - Added regression tests for collapsed sidebar sign-out loading feedback

### Test Results
- **Total Tests:** 67 tests across 14 test files
- **Pass Rate:** 100% (67/67 passing)
- **Coverage:** 89.4% overall (exceeds 80% threshold)
  - Statements: 89.4%
  - Branches: 88.39%
  - Functions: 80.26%
  - Lines: 89.4%
- **Test Files:**
  - `@outreachos/web`: 54 tests (11 files)
  - `@outreachos/db`: 9 tests (1 file)
  - `@outreachos/services`: 1 test (1 file)
  - `@outreachos/mcp-server`: 3 tests (1 file)

### Bugs Fixed
1. **OAuth Pending State Flicker** — Removed the unconditional `finally` block and moved pending state cleanup into the `catch` block for error-specific cleanup only, preventing premature clearing on successful OAuth redirects
2. **Missing Client Directive** — Added `"use client"` to dashboard page for `useSession()` hook
3. **Hardcoded Greeting** — Replaced static "Good morning" with dynamic time-aware greeting
4. **Sign-Out Error Swallowing** — Added user-visible error feedback in sidebar when sign-out fails
5. **Missing ARIA Semantics** — Added switch role, aria-checked, aria-label, aria-hidden across all interactive and decorative elements
6. **Inconsistent Icon Sizing** — Standardized icon sizing via parent wrapper classes instead of hardcoded SVG dimensions
7. **Switch className Target** — Fixed Switch component to apply className to root label instead of internal track div

### Validation
- `pnpm type-check` — **passes**
- `pnpm vitest run` — **passes** (67/67 tests, 0 failures)
- `pnpm vitest run --coverage` — **passes** (89.4% coverage, exceeds all thresholds)

### Open Questions
- None. All accessibility findings addressed and validated.

## Phase 3 — Contact Management & Data Layer

### Date: 2026-03-25

### Decisions Made

1. **Stitch Screen Conversions (4 screens):**
   - **Upload Contacts (`/contacts/upload`)** — Drag-and-drop zone with file validation (CSV/XLSX/XLS, 25MB max), required columns display, feature cards (CSV Template, Zapier, AI Auto-Mapping). Accessible drop zone with ARIA role/label.
   - **Enrichment (`/contacts/enrich`)** — Configuration panel with confidence threshold slider, toggle switches (LinkedIn retrieval, BYOK Hunter.io key), progress bar, start/skip buttons.
   - **Contacts List (`/contacts`)** — Server-side search/sort/filter via TanStack Query hooks, group filter dropdown, batch select with export/delete actions, score badges, loading spinner.
   - **Contact Detail (`/contacts/[id]`)** — Full contact profile with Hunter Intelligence card (score, status, sources), enrichment metadata, analytics placeholders (hourly/daily histograms), custom fields display.

2. **ContactService (`packages/services/src/contact-service.ts`)** — Static methods for all contact operations:
   - **CRUD:** `list` (search, group filter via subquery, sort, paginate), `getById`, `create`, `update`, `delete` (batch)
   - **CSV Parsing:** `parseCSV` with header normalization (maps 20+ column name variations), `parseCSVLine` with RFC 4180 quoted field support, `escapeCSV` for export
   - **Bulk Create:** `bulkCreate` with 100-row batching to avoid DB parameter limits, per-row error collection
   - **Group Management:** `listGroups`, `createGroup`, `addToGroup`, `removeFromGroup`, `deleteGroup`
   - **Export:** `exportCSV` generates full CSV string with all contact fields
   - **Enrichment Support:** `getUnenriched` (contacts without email), `updateEnrichment` (write Hunter.io results)

3. **EnrichmentService (`packages/services/src/enrichment-service.ts`)** — Hunter.io integration:
   - **Email Finder + Verifier pipeline** — Two-step: find email by domain/name, then verify deliverability
   - **Confidence gating** — Configurable threshold (default 80), only accepts `valid`/`accept_all` status
   - **Rate limiting** — Exponential backoff retry on HTTP 429 (base 1s, max 3 retries), 100ms throttle between contacts
   - **Batch processing** — Sequential processing with progress callbacks for streaming
   - **Re-enrichment** — Single contact re-enrichment by ID
   - **Domain extraction** — Robust URL parsing with bare-domain fallback

4. **API Endpoints (10 routes):**
   - `POST /api/contacts/upload` — FormData file upload, XLSX support via dynamic `xlsx` import, CSV parsing, bulk insert
   - `GET /api/contacts` — List with search/group/sort/pagination query params
   - `POST /api/contacts` — Create single contact
   - `DELETE /api/contacts` — Batch delete by IDs array
   - `GET /api/contacts/[id]` — Get single contact
   - `PATCH /api/contacts/[id]` — Update contact fields
   - `GET /api/contacts/export` — CSV download with Content-Disposition header
   - `GET /api/contacts/groups` — List groups
   - `POST /api/contacts/groups` — Create group
   - `POST /api/enrichment/batch` — Streaming NDJSON progress via ReadableStream

5. **Auth Helper (`lib/auth/session.ts`)** — `getAuthAccount()` resolves authenticated user's session to their DB account record via email lookup. Used by all API routes for authorization scoping.

6. **TanStack Query Hooks (`lib/hooks/use-contacts.ts`):**
   - `useContacts`, `useContact`, `useCreateContact`, `useUpdateContact`, `useDeleteContacts`, `useContactGroups`, `useCreateGroup`
   - Structured query keys for granular cache invalidation
   - Optimistic cache update on contact detail after mutation

7. **Package Configuration Changes:**
   - Source-level TypeScript exports (`"types": "./src/index.ts"`) in `@outreachos/db` and `@outreachos/services` package.json — enables type resolution without building packages first
   - Added `drizzle-orm` as direct dependency of `@outreachos/services` (was only transitive via `@outreachos/db`)
   - Added `xlsx` as dependency of `@outreachos/web` for Excel file parsing
   - Added `drizzle-orm` as devDependency of `@outreachos/web` for type resolution in session helper

### Test Suites Added (Phase 3)

- `packages/services/src/contact-service.test.ts` — **20 tests:** parseCSVLine (6), parseCSV (10), escapeCSV (4)
- `packages/services/src/enrichment-service.test.ts` — **23 tests:** extractDomain (11), delay (1), fetchWithRetry (5), enrichContact (6)
- `packages/services/src/index.test.ts` — **Updated to 4 tests:** barrel exports, static method checks, stub instantiation
- `apps/web/src/app/(dashboard)/contacts/contacts.test.tsx` — **20 tests:** ContactsPage List (7), UploadContactsPage (5), EnrichContactsPage (4), ContactDetailPage (4)
- `apps/web/src/app/app.test.tsx` — **Updated:** Added `use-contacts` mock, updated ContactsPage assertion for new UI

### Test Infrastructure
- `packages/services/vitest.config.ts` — Added `@outreachos/db` alias to mock module, preventing `DATABASE_URL` requirement in pure unit tests
- `packages/services/src/__mocks__/db.ts` — Mock DB client with chainable query builder stubs

### Final Validation
- `pnpm type-check` (web) — **passes**
- `pnpm type-check` (services) — **passes**
- `pnpm test:unit` (services) — **passes** (47 tests across 3 files)
- `pnpm test:unit` (web) — **passes** (74 tests across 12 files)
- **Total: 121 tests, 0 failures**

### Open Questions
- Hunter.io API key must be configured via `HUNTER_API_KEY` env var or BYOK in settings — no key bundled
- Enrichment batch endpoint streams NDJSON; client-side consumption hook not yet wired to the enrich page (UI shows static progress bar)
- Contact analytics (per-contact email stats, histograms) are placeholder — real data depends on Phase 5 email sending infrastructure
- Excel parsing uses `xlsx` package which is large (~2MB) — consider lazy-loading or server-side-only bundling optimization

---

## Full Test Suite Workflow — Phase 3 Refinement

### Date: 2026-03-26

### Bugs Found & Fixed

1. **Build-time crash: eager auth initialization** — `lib/auth/server.ts` called `createNeonAuth()` at module scope, causing Next.js build to fail when `NEON_AUTH_BASE_URL` was absent. **Fix:** Converted to lazy singleton via `getAuth()` with Proxy backward-compat wrapper. Updated `app/api/auth/[...path]/route.ts` to use lazy handler caching.

2. **Build-time crash: eager DB initialization** — `packages/db/src/drizzle.ts` called `neon()` and `drizzle()` at module scope, causing Next.js page data collection to fail when `DATABASE_URL` was absent. **Fix:** Converted to lazy singleton via `getDb()` with Proxy backward-compat wrapper. Updated db test to trigger lazy init before mock assertions.

3. **Unsafe type assertion for route params** — `contacts/[id]/page.tsx` used `params.id as string` which is unsafe when `params.id` could be `string[]`. **Fix:** Added `Array.isArray` check with early-return error UI for missing contactId.

### Refactoring

1. **Extracted shared test helpers** — Created `apps/web/src/test/api-helpers.ts` with `createMockRequest()` and `createMockAccount()`. Deduplicated from 5 test files (contacts route, [id] route, export route, groups route, upload route).

2. **Auth route lazy handler** — `app/api/auth/[...path]/route.ts` restructured from eager `export const { GET, POST } = auth.handler()` to lazy cached handler functions.

### New Tests Created

| File | Tests | Coverage |
|---|---|---|
| `app/api/contacts/route.test.ts` | 18 | GET (auth, pagination, sorting, clamping, errors), POST (auth, validation, customFields, creation), DELETE (auth, batch limits, id filtering) |
| `app/api/contacts/[id]/route.test.ts` | 10 | GET (auth, 404, success, errors), PATCH (auth, JSON validation, schema validation, 404, success, errors) |
| `app/api/contacts/groups/route.test.ts` | 8 | GET (auth, success, errors), POST (auth, name validation, creation, JSON errors, service errors) |
| `app/api/contacts/upload/route.test.ts` | 9 | Auth, file validation (missing, type, size), CSV parsing errors, empty data, success, bulk errors, service errors |

### Security Audit

- **17 vulnerabilities** found via `pnpm audit`
  - `xlsx@0.18.5` — 2 high (Prototype Pollution, ReDoS) — **production dep**, no OSS patch (SheetJS paywall). Mitigated by server-side-only usage with 25MB file size limit.
  - `minimatch`, `picomatch` — dev-only transitive deps (eslint, vitest). No production risk.
- **No hardcoded secrets** detected in source code.

### Final Validation

- `pnpm type-check` (all workspaces) — **passes**
- `pnpm test:unit` (all workspaces) — **187 tests, 0 failures**
  - `@outreachos/web`: 17 files, 123 tests
  - `@outreachos/services`: 3 files, 52 tests
  - `@outreachos/db`: 1 file, 9 tests
  - `@outreachos/mcp-server`: 1 file, 3 tests
- `pnpm build` (web) — **succeeds** (16 routes, all static/dynamic correctly categorized)
- No integration, E2E, or performance test suites configured yet
