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

---

## Phase 4 — Campaigns, Templates & Experimentation Engine

### Date: 2026-03-26

### Decisions Made

1. **LLMService (`packages/services/src/llm-service.ts`)** — Google Gemini 2.5 Pro integration:
   - Uses `@google/genai` client for API calls
   - Structured prompt construction for email generation, subject line variants, and email rewriting
   - Usage logging to `llm_usage_log` table (provider, model, purpose, token counts, latency)
   - Default model: `gemini-2.5-pro`, max output tokens: 2048

2. **TemplateService (`packages/services/src/template-service.ts`)** — Email template CRUD:
   - Token system: regex extraction of `{TokenName}` patterns from HTML/text
   - Rendering: replaces tokens with contact data context or fallback values
   - Versioning: auto-increments version on update
   - Duplication: creates copy with "(Copy)" suffix and version reset
   - Import: text, markdown (→ HTML via simple converter), and HTML formats

3. **CampaignService (`packages/services/src/campaign-service.ts`)** — Campaign CRUD and email delivery:
   - Send orchestration via Resend API with per-contact template rendering
   - 100ms throttle between sends (~10 emails/s) for rate limit compliance
   - Progress callback for streaming send status to client
   - Webhook event processing: maps Resend event types to message instance status updates
   - Deliverability monitoring: auto-pauses campaign at 0.1% complaint rate threshold
   - HMAC signature validation for Resend webhook security (SHA-256 + hex comparison)

4. **ExperimentService (`packages/services/src/experiment-service.ts`)** — A/B testing engine:
   - Experiment CRUD scoped by accountId
   - Batch management: auto-incrementing batch numbers, 20 contacts per variant default
   - Evaluation: computes open rates per variant from message instance data
   - Winner detection: variant needs ≥40% open rate threshold to win a batch
   - Champion detection: requires 2 consecutive batch wins by same variant
   - Promotion: locks champion variant to production status

5. **AnalyticsService (`packages/services/src/analytics-service.ts`)** — Campaign metrics:
   - Aggregate metrics: sent, delivered, failed, opened (total + unique), clicked, bounced, complained, unsubscribed
   - Computed rates: open, click, bounce, complaint, unsubscribe
   - Hourly distribution: opens/clicks by hour of day (0–23) for send-time optimization
   - Daily distribution: opens/clicks by day of week (0=Sun–6=Sat)

6. **API Routes (12 endpoints):**
   - `GET/POST /api/campaigns` — List (with status filter) and create
   - `GET/PATCH/DELETE /api/campaigns/[id]` — Single campaign CRUD
   - `POST /api/campaigns/[id]/send` — SSE streaming send with progress
   - `GET /api/campaigns/[id]/analytics` — Full metrics + hourly + daily
   - `GET/POST /api/templates` — List and create
   - `GET/PATCH/DELETE /api/templates/[id]` — Single template CRUD
   - `POST /api/templates/import` — File upload (text/md/html)
   - `POST /api/templates/generate` — LLM actions (generate_email, generate_subjects, rewrite)
   - `GET/POST /api/experiments` — List and create
   - `GET/DELETE /api/experiments/[id]` — Summary and delete
   - `POST /api/experiments/[id]/evaluate` — Batch evaluation + champion check
   - `POST /api/webhooks/resend` — Resend webhook ingestion with HMAC validation

7. **React Query Hooks:**
   - `lib/hooks/use-campaigns.ts` — `useCampaigns`, `useCampaign`, `useCreateCampaign`, `useUpdateCampaign`, `useDeleteCampaign`, `useCampaignAnalytics`
   - `lib/hooks/use-templates.ts` — `useTemplates`, `useTemplate`, `useCreateTemplate`, `useUpdateTemplate`, `useDeleteTemplate`, `useGenerateEmail`, `useGenerateSubjects`, `useRewriteEmail`

8. **Stitch Screen Conversions (5 screens):**
   - **Campaigns List (`/campaigns`)** — Status filter chips, table with name/type/status/date, empty state, delete actions
   - **Campaign Type Selector (`/campaigns/new`)** — 2-step wizard: type selection (One-Time, A/B Test, Newsletter) → details (name, group, template)
   - **A/B Test Setup (`/campaigns/ab-test/setup`)** — Group selection with radio UI, Suspense boundary for `useSearchParams()`
   - **A/B Subject Test (`/campaigns/ab-test/[id]/subject`)** — Dual subject line inputs, AI subject generator, word count hints, preview panel
   - **Template Editor (`/templates/[id]/edit`)** — Split-pane: editor with token picker + HTML textarea + preview, collapsible AI Workshop panel (rewrite instruction + subject suggestions)
   - **Campaign Analytics (`/campaigns/[id]/analytics`)** — 4-stat KPI grid, secondary metrics, hourly + daily heatmap charts
   - **Templates List (`/templates`)** — Card grid with token badges, inline create dialog, version display

9. **Package Exports Updated:**
   - `packages/services/src/index.ts` — Added type exports for all Phase 4 service interfaces (CampaignType, CampaignStatus, ExperimentType, LLMConfig, CampaignMetrics, etc.)

### Test Suites Added (Phase 4)

| File | Tests | Coverage |
|---|---|---|
| `services/src/template-service.test.ts` | 13 | extractTokens (7), render (6) |
| `services/src/llm-service.test.ts` | 1 | Class structure and method exports |
| `services/src/experiment-service.test.ts` | 4 | Class structure (1), computeOpenRate (3) |
| `services/src/campaign-service.test.ts` | 3 | Class structure (1), validateWebhookSignature (2) |
| `services/src/analytics-service.test.ts` | 1 | Class structure and method exports |
| `web/src/app/app.test.tsx` | Updated | Added use-campaigns/use-templates mocks, updated assertion for new campaigns page |

### Bugs Fixed

1. **`z.record()` arity** — Zod v4 requires 2 arguments (key + value schema). Fixed all route schemas from `z.record(z.string())` to `z.record(z.string(), z.string())`.
2. **`contactCount` property** — A/B setup page referenced non-existent `contactCount` on `ContactGroup` type. Fixed to use `description`.
3. **`useSearchParams()` Suspense** — A/B test setup page used `useSearchParams()` without Suspense boundary, causing Next.js static generation failure. Fixed with wrapper + `<Suspense>`.
4. **Campaigns test assertion** — `app.test.tsx` expected old Phase 4 placeholder text. Updated mock and assertion for new campaigns list page.

### Dependencies Added
- `resend@4.5.1` — Email delivery API client
- `@google/genai@1.8.0` — Google Gemini AI client

### Final Validation
- `pnpm type-check` (all 4 workspaces) — **passes**
- `pnpm vitest run` (services) — **74 tests, 0 failures** (8 files)
- `pnpm vitest run` (web) — **123 tests, 0 failures** (17 files)
- `pnpm build` — **passes** (25 routes)
- **Total: 197+ tests, 0 failures**

### Code Review Fixes (58 findings resolved)

| Finding | File | Fix Applied |
|---------|------|-------------|
| XSS risk in preview | `templates/[id]/edit/page.tsx` | Added `DOMPurify.sanitize(bodyHtml)` before `dangerouslySetInnerHTML` |
| Close button lacks label | `templates/[id]/edit/page.tsx` | Added `aria-label="Close"` to AI Workshop × button |
| Back button lacks label | `templates/[id]/edit/page.tsx` | Added `aria-label="Go back"` to toolbar ← button |
| Subject generation unhandled errors | `templates/[id]/edit/page.tsx` | Wrapped `mutateAsync` in try/catch + added `subjectsMutation.isError` UI |
| Form overwrites on refetch | `templates/[id]/edit/page.tsx` | Added `initializedRef` to prevent overwriting user edits |
| Save timeout leak | `templates/[id]/edit/page.tsx` | Added `savedTimeoutRef` with cleanup useEffect on unmount |
| Save unhandled errors | `templates/[id]/edit/page.tsx` | Added try/catch around `updateMutation.mutateAsync` |
| Template fetch no error UI | `templates/[id]/edit/page.tsx` | Added `isError`/`error` check with error state + back button |
| Campaign status misclassifies | `campaign-service.ts` | Fixed `finalStatus` logic: only "stopped" when `total > 0 && failed === total` |
| Webhook status regression | `campaign-service.ts` | Added `statusPrecedence` check + timestamp guards to prevent out-of-order webhook regressions |
| Resend error handling | `campaign-service.ts` | Added error classification (`getResendErrorCode`, `isRetryableError`) + retry loop with exponential backoff |
| computeOpenRate encapsulation | `experiment-service.ts` | Extracted `computeOpenRate` to exported function for proper testing without breaking class encapsulation |
| MIN_BATCH_SIZE validation | `experiment-service.ts` | Added `MIN_BATCH_SIZE` constant (10) + validation in `evaluateBatch` to ensure statistical significance before computing open rates |
| Markdown parser naivety | `template-service.ts` | Replaced naive regex markdown parser with stateful parser handling blockquotes, lists, code blocks, headers, inline formatting |
| Regex global flag bug | `template-service.ts` | Removed `g` flag from `extractTokens` regex to prevent `lastIndex` state issues with `exec()` in loop |
| Template update TOCTOU race | `template-service.ts` | Added optimistic locking with `eq(templates.version, existing.version)` in WHERE clause and conflict detection |
| Render HTML injection | `template-service.ts` | Added `escapeHtml` helper and applied to all substituted values in `render()` to prevent XSS |
| A/B test setup error handling | `campaigns/ab-test/setup/page.tsx` | Added try/catch around `updateMutation.mutateAsync` with error state and UI feedback |
| A/B test setup ARIA semantics | `campaigns/ab-test/setup/page.tsx` | Added `role="radiogroup"`, `role="radio"`, `aria-checked`, `aria-label`, and keyboard support |
| A/B test setup missing error handling | `campaigns/ab-test/setup/page.tsx` | Added campaignId validation, groupsError handling, and error UI states |
| Back button unpredictable navigation | `campaigns/new/page.tsx` | Changed `router.back()` to `router.push("/campaigns")` for explicit navigation |
| Create campaign error handling | `campaigns/new/page.tsx` | Added try/catch around `createMutation.mutateAsync`, response validation, and error UI |
| Form label associations | `campaigns/new/page.tsx` | Added `htmlFor` to labels and matching `id` to inputs/selects for screen reader accessibility |
| Subject generation silent error | `campaigns/ab-test/[id]/subject/page.tsx` | Added `generationError` state and UI to surface AI generation failures |
| Experiment creation silent error | `campaigns/ab-test/[id]/subject/page.tsx` | Added `createError` state, try/catch around fetch, `creating` loading state, and error UI for failed experiment creation |
| Status parameter unsafe cast | `api/campaigns/route.ts` | Replaced unsafe TypeScript cast with runtime validation using `VALID_STATUSES` allowlist |
| Malformed JSON handling | `api/campaigns/route.ts` | Wrapped `request.json()` in try/catch to return 400 Bad Request for malformed JSON instead of 500 |
| Experiment creation missing ownership check | `api/experiments/route.ts` | Added `CampaignService.getById` verification before creating experiment to ensure campaign belongs to account |
| Malformed JSON handling (experiments) | `api/experiments/route.ts` | Wrapped `request.json()` in try/catch to return 400 Bad Request for malformed JSON instead of 500 |
| DOCX binary handling | `api/templates/import/route.ts` | Removed DOCX from ALLOWED_TYPES since binary files require special parsing (mammoth or similar) |
| scheduledAt null semantics | `api/campaigns/[id]/route.ts` | Fixed `scheduledAt` conversion to preserve `null` when explicitly null, `undefined` when omitted, and `Date` only for non-null values |
| Batch ownership validation | `api/experiments/[id]/evaluate/route.ts` | Added DB query to verify batch belongs to experiment before evaluating, return 404/403 if mismatch |
| Malformed JSON handling (templates) | `api/templates/[id]/route.ts` | Wrapped `request.json()` in try/catch to return 400 Bad Request for malformed JSON instead of 500 |
| Malformed JSON handling (generate) | `api/templates/generate/route.ts` | Wrapped `request.json()` in try/catch with type guard for body.action to return 400 for malformed JSON |
| Malformed JSON handling (templates POST) | `api/templates/route.ts` | Wrapped `request.json()` in try/catch to return 400 Bad Request for malformed JSON instead of 500 |
| Mandatory webhook signature validation | `api/webhooks/resend/route.ts` | Made signature validation mandatory - returns 500 if secret not configured, always validates signature with 401 on failure |
| Delete mutation 204 handling | `hooks/use-templates.ts` | Updated `useDeleteTemplate` to handle 204 No Content or empty body responses |
| Test comment consistency | `template-service.test.ts` | Fixed contradictory comments in empty string test to match actual fallback behavior |
| List indent detection | `template-service.ts` | Fixed markdown list regex to match against original `line` instead of `trimmed` to capture leading whitespace correctly |
| Code block XSS | `template-service.ts` | HTML-escaped code block content in `flushCodeBlock` using `TemplateService.escapeHtml` to prevent injection |
| Token regex infinite loop | `template-service.ts` | Fixed `extractTokens` to use `matchAll(TOKEN_REGEX)` instead of `exec` without global flag |
| Email send retry logic | `campaign-service.ts` | Refactored retry loop to properly wrap each `resend.emails.send` in try/catch with exponential backoff and correct progress tracking |
| createBatch ownership check | `experiment-service.ts` | Added `accountId` parameter and ownership validation in SELECT ... FOR UPDATE query |
| LLM error classification | `llm-service.ts` | Normalized error message to lowercase, added `enotfound` and `econnrefused` to network error detection |
| Experiment ownership check | `api/experiments/[id]/evaluate/route.ts` | Added DB query to verify experiment belongs to authenticated account before evaluating |
| UpdateCampaignInput type | `campaign-service.ts` | Updated `scheduledAt` type to accept `Date | null | undefined` for proper null semantics |
| Timing attack vulnerability | `campaign-service.ts` | Replaced string comparison with constant-time byte comparison in `validateWebhookSignature` using XOR-accumulate over raw HMAC bytes |
| Webhook signature test coverage | `campaign-service.test.ts` | Added `computeTestSignature` helper + tests for valid signatures and wrong-secret scenarios |
| LLM error handling | `llm-service.ts` | Added try/catch with typed error mapping (RATE_LIMIT_EXCEEDED, AUTH_ERROR, NETWORK_ERROR) and isolated DB logging try/catch to preserve response on logging failure |
| consecutiveWins default value | `experiment-service.ts` | Changed `consecutiveWins: 0` to `consecutiveWins: null` in `create` to let DB apply default(0) |
| PostgreSQL count type safety | `analytics-service.ts` | Cast `COUNT(*)` and `SUM()` results to `::int` to prevent string/number type issues |
| Auto-pause status overwrite | `campaign-service.ts` | Added `wasAutoPaused` flag to preserve "paused" status and skip final status update when auto-paused due to complaint rate |
| Complaint rate undercount | `campaign-service.ts` | Removed `status === "sent"` filter from `checkComplaintRate` total count to include all attempted sends |
| createBatch TOCTOU race | `experiment-service.ts` | Wrapped batch creation in transaction with `FOR UPDATE` lock on experiment row to prevent race condition |
| checkForChampion missing account scoping | `experiment-service.ts` | Added `eq(experiments.accountId, accountId)` to champion update query for multi-tenant security |
| consecutiveWins update missing account scoping | `experiment-service.ts` | Added `eq(experiments.accountId, accountId)` to consecutiveWins update query for multi-tenant security |

### Open Questions
- Resend API key (`RESEND_API_KEY`) and domain verification required before live email sending
- Gemini API key (`GEMINI_API_KEY`) required for LLM features — free tier has quota limits
- Resend webhook secret (`RESEND_WEBHOOK_SECRET`) must be configured for production webhook validation
- Template editor is HTML-based textarea — rich text editor upgrade deferred to future iteration
- Experiment batch orchestration (auto-scheduling batches) is manual via API — cron/scheduler deferred

---

## Phase 5 — Journeys, Funnels, Inbox, Forms & SEO

### Date: 2026-03-28

### Decisions Made

1. **JourneyService state machine** — Linear state progression: `enrolled → initial_sent → first_followup_sent → second_followup_sent → hail_mary_sent → completed`. Contacts can also be `removed` (replied, unsubscribed, manual). State transitions happen in `advanceEnrollment()` after each successful send.

2. **journeyEnrollments table** — New schema table added to `campaigns.ts` with `unique(campaignId, contactId)` constraint. Tracks per-contact journey state, current step, next send time, and removal reason. Linked to campaigns and campaign_steps via foreign keys.

3. **Cron-driven journey processing** — `JourneyService.processDueSends()` queries enrollments where `nextSendAt <= now` and processes in batches of 100. Two Vercel Cron endpoints created: `/api/cron/journey-process` (journey sends) and `/api/cron/inbox-poll` (IMAP reply detection). Both validate `CRON_SECRET` bearer token.

4. **InboxService reply detection** — Three-tier matching strategy: (1) `In-Reply-To` header → `resendMessageId`, (2) `References` header fallback, (3) sender email → most recent message instance. `fetchUnseenEmails()` is abstracted for testing — production IMAP implementation deferred until `node-imap` integration.

5. **FormService with 5 pre-built templates** — Minimal, Modal, Inline Banner, Multi-Step Wizard, Side Drawer. Each template has base HTML/CSS stored as constants. Forms support 7 field types: text, email, phone, dropdown, checkbox, textarea, hidden. Embed code generation supports hosted link, iframe, and JS widget methods.

6. **Public form submission endpoint** — `POST /api/forms/submit` is unauthenticated (public-facing). It looks up `accountId` from the form record to create/match contacts. IP address and user agent captured for analytics.

7. **BlogService with newsletter subscriptions** — Markdown-based CMS with `generateStaticParams` for ISR. Newsletter subscribers auto-added to a `newsletter_subscriber` contact group. Public subscribe endpoint at `POST /api/newsletter/subscribe`.

8. **Blog SSR with ISR** — Blog list and post pages use `revalidate = 60` for incremental static regeneration. `generateMetadata` provides OpenGraph tags for SEO. `generateStaticParams` pre-renders published post slugs.

### Deliverables

| Component | Files | Description |
|---|---|---|
| **Schema** | `packages/db/src/schema/campaigns.ts` | Added `journeyEnrollments` table + relations |
| **JourneyService** | `packages/services/src/journey-service.ts` | Journey CRUD, enrollment, cron processing, state machine |
| **InboxService** | `packages/services/src/inbox-service.ts` | IMAP poll, reply matching, contact reply status updates |
| **FormService** | `packages/services/src/form-service.ts` | Form CRUD, 5 templates, submissions, embed code generation |
| **BlogService** | `packages/services/src/blog-service.ts` | Blog CRUD, newsletter subscriptions, tag queries |
| **Journey API** | `apps/web/src/app/api/journeys/` | CRUD + enrollment routes (3 files) |
| **Forms API** | `apps/web/src/app/api/forms/` | CRUD + submissions + embed + public submit (5 files) |
| **Blog API** | `apps/web/src/app/api/blog/` | CRUD + public slug route (2 files) |
| **Cron API** | `apps/web/src/app/api/cron/` | Journey processing + inbox poll (2 files) |
| **Newsletter API** | `apps/web/src/app/api/newsletter/subscribe/` | Public subscription endpoint |
| **Hooks** | `apps/web/src/lib/hooks/use-journeys.ts`, `use-forms.ts` | TanStack Query hooks for journeys & forms |
| **Journey Builder UI** | `apps/web/src/app/(dashboard)/campaigns/journey/[id]/page.tsx` | Timeline view, progress stats, enrollment |
| **Forms Dashboard UI** | `apps/web/src/app/(dashboard)/forms/page.tsx` | Form grid with submission counts |
| **Choose Form Template** | `apps/web/src/app/(dashboard)/forms/new/page.tsx` | 5 template type cards |
| **Form Editor** | `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx` | Fields, design, settings tabs |
| **Embed Code UI** | `apps/web/src/app/(dashboard)/forms/[id]/embed/page.tsx` | Hosted/iframe/widget code snippets |
| **Blog List** | `apps/web/src/app/blog/page.tsx` | Public blog listing with ISR |
| **Blog Post** | `apps/web/src/app/blog/[slug]/page.tsx` | Post page with SEO metadata + static params |
| **Newsletter Widget** | `apps/web/src/components/features/newsletter-subscribe.tsx` | Embeddable subscribe component |

### Test Results
- **services:** 77 tests passing (8 files)
- **web:** 123 tests passing (17 files)
- **Type-check:** All 3 workspaces clean (db, services, web)

### Open Questions
- IMAP `fetchUnseenEmails()` returns empty — requires `node-imap` package installation and real IMAP server for production
- Blog content stored as raw HTML/markdown — need markdown-to-HTML rendering pipeline for production (e.g., `remark` + `rehype`)
- Form widget JS (`/widget/{formId}.js`) endpoint not yet implemented — deferred until embed demand confirmed
- Funnel Builder UI deferred — engine reuses Journey service with different entry conditions
- A/B Body/CTA test phase deferred — requires champion subject from Phase 4 experiments

---

## Phase 7 — Developer API, Billing & Hardening

> **Note:** Phase 6 was intentionally skipped. The originally planned Advanced Analytics & Reporting phase was deferred to a later release to prioritize Developer API infrastructure and billing hardening, which are prerequisites for customer-facing features and monetization.

### Date: 2026-03-28

### Decisions Made

1. **Developer Dashboard UI** — Two Stitch screens converted: API Keys Management (`/(dashboard)/developer`) with tabs for Keys, Docs, Webhooks, Usage; Usage Analytics (`/(dashboard)/developer/usage`) with time-range selector, endpoint performance table, cost projections, LLM token tracking.

2. **REST API v1** — Full REST API surface at `/api/v1/*` mirroring all MCP tools. Routes for: campaigns (CRUD + status), contacts (CRUD + groups), templates (CRUD), linkedin (playbook list + copy generation). All routes protected by API key auth with scope enforcement.

3. **API Key Authentication** — `lib/api/auth.ts` implements Bearer token validation via SHA-256 hash lookup. Features: rate limiting (100 req/min per key), usage tracking per endpoint, scope enforcement (read/write/admin). Keys generated with `osk_` prefix and stored as hashes.

4. **OpenAPI 3.1 Documentation** — `/api/docs` endpoint returns full OpenAPI spec with all endpoints, schemas, security definitions, and examples. Auto-serves JSON for API documentation tools.

5. **Outbound Webhooks** — `webhooks` and `webhook_deliveries` tables with retry logic (5 retries, exponential backoff). `WebhookService` handles HMAC-SHA256 signing, delivery with timeout, retry scheduling. Events: email.sent/delivered/opened/clicked/bounced, contact.created/updated, campaign.started/completed.

6. **Billing Abstraction** — `billing_plans` and `account_billing` tables with Stripe-ready fields. `BillingService` provides: usage quota checking, metering increment, monthly reset, summary for dashboard. Default free tier limits: 1000 contacts, 500 emails/month, 100K LLM tokens, 50 Hunter credits, 10K API calls.

7. **Security Service** — `SecurityService` with: account security audit (stale keys, privileged access), Resend webhook HMAC validation, LLM input sanitization (injection prevention), field name safety checks (prototype pollution), GDPR data export/deletion. Uses timing-safe comparison for signatures.

8. **UI Component Updates** — Added `outline` and `destructive` variants to Button, `destructive` variant to Badge, `onOpenChange` prop to Modal for compatibility with common patterns.

### Deliverables

| Component | Files | Description |
|---|---|---|
| **Developer UI** | `apps/web/src/app/(dashboard)/developer/page.tsx` | API Keys management with BYOK status |
| **Usage Analytics** | `apps/web/src/app/(dashboard)/developer/usage/page.tsx` | Endpoint performance, cost projections |
| **API Auth** | `apps/web/src/lib/api/auth.ts` | Bearer token validation, rate limiting, usage tracking |
| **REST API v1** | `apps/web/src/app/api/v1/*/route.ts` | 6 endpoint groups (campaigns, contacts, groups, templates, linkedin) |
| **OpenAPI Docs** | `apps/web/src/app/api/docs/route.ts` | OpenAPI 3.1 spec endpoint |
| **Developer Keys API** | `apps/web/src/app/api/developer/keys/` | Create/list/revoke API keys |
| **Developer Usage API** | `apps/web/src/app/api/developer/usage/route.ts` | Usage statistics aggregation |
| **Webhooks API** | `apps/web/src/app/api/developer/webhooks/` | Webhook CRUD endpoints |
| **WebhookService** | `packages/services/src/webhook-service.ts` | Dispatch, delivery, retry logic, HMAC signing |
| **BillingService** | `packages/services/src/billing-service.ts` | Quota enforcement, metering, Stripe-ready |
| **SecurityService** | `packages/services/src/security-service.ts` | Audit, HMAC validation, sanitization, GDPR |
| **Schema Updates** | `packages/db/src/schema/misc.ts` | webhooks, webhook_deliveries, billing_plans, account_billing tables |

### Test Results
- **db:** 9 tests passing
- **services:** 90 tests passing
- **mcp-server:** 5 tests passing
- **web:** 137 tests passing
- **Total:** 241 tests passing across 4 workspaces
- **Type-check:** All workspaces clean

### Security Hardening Checklist
- [x] API key hashing with SHA-256
- [x] Timing-safe signature comparison
- [x] Rate limiting per API key
- [x] Scope enforcement (read/write/admin)
- [x] Prototype pollution protection in field names
- [x] LLM prompt sanitization
- [x] HMAC webhook signature validation
- [x] GDPR data export/deletion endpoints
- [x] Security audit with stale key detection

### Open Questions
- Stripe integration requires webhook endpoint for subscription events
- Webhook delivery worker should run as background job (Vercel Cron or separate worker)
- Rate limiting uses in-memory store — production should use Redis for distributed rate limiting

## Phase 5/6 Stabilization — 2026-04-12

### Scope
- Cleared the remaining TypeScript failures blocking `pnpm type-check` across `apps/web` route tests, API routes, and the contacts dashboard icon typing.
- Wired public form submissions to execute mapped journey/funnel automation after contact creation or lookup.
- Implemented the funnel `filled_form` condition by matching submitted form contacts through `form_submissions`.
- Fixed newsletter merge-token rendering to use the correct template context keys and corrected final total accounting for resumed sends.
- Added a dedicated preferences API (`/api/settings/preferences`) and connected the settings page to both preferences and BYOK persistence.
- Embedded the newsletter subscribe widget directly on public blog post pages.
- Added regression coverage for the preferences route and LLM auto-fallback routing.

### Validation
- `pnpm type-check` — **passes**.
- `pnpm --filter @outreachos/web test:unit -- src/app/api/settings/byok/route.test.ts src/app/api/settings/preferences/route.test.ts` — **passes** (web suite completed cleanly, 503 tests).
- `pnpm --filter @outreachos/services test:unit -- src/llm-service.test.ts` — **passes** (services suite completed cleanly, 103 tests).

### Remaining Gaps
- Settings now supports per-account LLM preference and BYOK management, but plan items that depend on external Stitch generation, deployment, or broader quota-metering policy remain separate follow-up work.
- Phase 5/6 still have larger end-to-end and integration checklist items that were not part of this stabilization pass.

## Phase 5.8 Newsletter Send Flow — 2026-04-12

### Scope
Implemented the three core newsletter features from Phase 5.8:

1. **Rich Newsletter Templates**
   - Added `templateType` field to `templates` table (`simple`, `rich`, `newsletter`)
   - Implemented `renderRichNewsletter()` with HTML email wrapper, responsive layout, and styled blog embed section
   - Updated `send()` method to auto-detect rich templates and use rich rendering

2. **Recurring Newsletter Scheduling**
   - Added `recurrence` field to `campaigns` table (`none`, `weekly`, `monthly`)
   - Added `lastSentAt` field for tracking send history
   - Implemented `schedule()` for one-off scheduled sends
   - Implemented `setupRecurringSchedule()` for configuring recurrence
   - Implemented `processRecurringNewsletters()` cron job handler that clones completed newsletters for next occurrence
   - Updated `/api/cron/newsletter-send` to process recurring newsletters after sends complete

3. **Blog Content Embedding**
   - Added `embedBlogPosts` setting to newsletter configuration
   - Implemented `getLatestBlogPosts()` to fetch recent published posts
   - Rich newsletters automatically render blog section with title, excerpt, and link when `embedBlogPosts > 0`

### Files Modified
- `packages/db/src/schema/campaigns.ts` — Added `templateType`, `recurrence`, `lastSentAt` fields
- `packages/services/src/newsletter-service.ts` — Added rich rendering, blog embedding, recurring scheduling methods
- `apps/web/src/app/api/cron/newsletter-send/route.ts` — Added recurring newsletter processing
- `outreachos-implementation-plan.md` — Marked 5.8 items complete

### Validation
- `pnpm type-check` — **passes** across all packages
- Schema changes are backward compatible (new fields have defaults)
- Rich rendering gracefully falls back to simple rendering for legacy templates

## Phase 5.9 Testing — 2026-04-12

### Scope
Implemented comprehensive test coverage for Phase 5 features:

1. **Unit Tests: JourneyService, FunnelService, InboxService, FormService**
   - `journey-service.test.ts`: 6 tests covering journey CRUD, enrollment, state machine, step configuration
   - `funnel-service.test.ts`: 10 tests covering funnel CRUD, condition evaluation, entry conditions
   - `inbox-service.test.ts`: 19 tests covering IMAP config, reply matching, email parsing, Gmail labeling
   - `form-service.test.ts`: 18 tests covering form CRUD, submissions, embed code generation, automation mapping

2. **Integration Test: Form → Contact → Funnel → Email**
   - `packages/services/src/integration/form-to-funnel.test.ts`: 10 tests
   - Tests complete workflow: form submission → contact creation/matching → funnel enrollment → email scheduling
   - Covers error handling, data consistency, custom field preservation

3. **E2E Test: Journey Flow with Mocked IMAP**
   - `packages/services/src/e2e/journey-flow.test.ts`: 8 tests
   - Simulates complete journey lifecycle: enrollment → sends → reply detection → removal/completion
   - Tests IMAP reply matching strategies (In-Reply-To, References, sender email)
   - Covers error recovery and state progression

4. **Reply Detection Accuracy Tests**
   - `inbox-service.reply-detection.test.ts`: 25 tests
   - Tests In-Reply-To header matching precision
   - Tests References header chain matching
   - Tests sender email fallback matching
   - Covers edge cases: special characters, circular references, malformed headers
   - Includes precision/recall metrics calculations

5. **Blog SEO Tests**
   - `apps/web/src/app/blog/seo.test.tsx`: Tests for meta tags, OG images, sitemap
   - Verifies title/description generation, canonical URLs
   - Tests Open Graph and Twitter Card tags
   - Tests JSON-LD structured data, RSS feed format
   - Validates sitemap XML structure and pagination

### Files Created
- `packages/services/src/journey-service.test.ts` (6 tests)
- `packages/services/src/funnel-service.test.ts` (10 tests)
- `packages/services/src/inbox-service.test.ts` (19 tests)
- `packages/services/src/inbox-service.reply-detection.test.ts` (25 tests)
- `packages/services/src/form-service.test.ts` (18 tests)
- `packages/services/src/integration/form-to-funnel.test.ts` (10 tests)
- `packages/services/src/e2e/journey-flow.test.ts` (8 tests)
- `apps/web/src/app/blog/seo.test.tsx` (SEO verification tests)

### Validation
- `pnpm --filter @outreachos/services test:unit` — **199 tests passing**
- All new test files pass with mocked database dependencies
- `outreachos-implementation-plan.md` — Phase 5.9 marked complete
