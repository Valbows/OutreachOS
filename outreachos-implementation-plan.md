# OutreachOS — Implementation Plan

This plan defines the full phased build strategy for OutreachOS, an AI-powered email automation platform, structured per the S.A.F.E. D.R.Y. A.R.C.H.I.T.E.C.T. planning workflow with explicit architecture direction, security model, DevOps strategy, per-phase objectives/deliverables/dependencies/risks, and CI/CD pipeline definitions.

---

## 1. Planning Context

- **Classification:** New project from scratch.
- **Type:** Multi-tenant SaaS web application with AI features, MCP agent layer, and developer API.
- **Source Documents:** Product Requirements Document (PRD v1.0), Google Stitch design project (20 screens), Stitch "Luminous Intelligence" design system.
- **Operator:** Valery Rene (founder, primary power user).

---

## 2. Architecture Direction

### 2.1 Technical Architecture

| Layer | Choice | Reference |
|---|---|---|
| **Monorepo** | Turborepo | https://turbo.build/repo/docs |
| **Web App** | Next.js 15 App Router | https://nextjs.org/docs/app |
| **Auth** | Neon Auth (Better Auth) — email/password + OAuth (Google, GitHub) | https://neon.com/docs/auth/overview · https://neon.com/docs/auth/quick-start/nextjs · https://neon.com/docs/auth/guides/setup-oauth |
| **Database** | Neon Postgres (serverless) | https://neon.com/docs/introduction · https://neon.com/docs/guides/nextjs |
| **ORM** | Drizzle ORM (`drizzle-orm/neon-http`) | https://orm.drizzle.team/docs/tutorials/drizzle-nextjs-neon |
| **Server State** | TanStack Query (React Query v5) | fetch/mutate/cache/invalidate/background-refresh |
| **Client State** | Zustand | local UI/app state persisting across components |
| **Email Delivery** | Resend | https://resend.com/docs/api-reference/introduction · https://resend.com/docs/api-reference/emails/send-email · https://resend.com/docs/llms.txt |
| **Contact Enrichment** | Hunter.io API v2 | https://hunter.io/api · https://hunter.io/api-documentation · https://hunter.io/api/email-finder · https://help.hunter.io/en/articles/1970956-hunter-api |
| **LLM Primary** | Gemini 2.5 Pro | https://ai.google.dev/gemini-api/docs · https://ai.google.dev/api |
| **LLM Fallback** | OpenRouter | https://openrouter.ai/docs/guides/guides/mcp-servers |
| **Email Templates** | React Email + MJML | https://react.email/docs/introduction · https://react.email/docs/getting-started/manual-setup · https://mjml.io/documentation/ |
| **File Parsing** | Mammoth.js (.docx) | https://github.com/mwilliamson/mammoth.js |
| **IMAP/SMTP** | node-imap + Nodemailer | https://github.com/mscdex/node-imap · https://nodemailer.com/ |
| **MCP Server** | Model Context Protocol (HTTP+SSE / STDIO) | https://modelcontextprotocol.io/docs/learn/architecture · https://modelcontextprotocol.io/docs/learn/server-concepts |
| **Cron/Background** | Vercel Cron Jobs | https://vercel.com/docs/cron-jobs · https://vercel.com/kb/guide/how-to-setup-cron-jobs-on-vercel |
| **Containerization** | Docker + Docker Compose (local dev) | — |
| **Deploy** | Vercel (Hobby → Pro) | https://vercel.com/docs/frameworks/full-stack/nextjs |
| **Design Source** | Google Stitch (project `13517806960470855745`) | https://stitch.withgoogle.com/ |

**Architecture Style:** Turborepo-style modular monorepo. One primary Next.js app (`apps/web`) hosts the platform UI, blog, and REST API routes. The MCP server lives in its own package (`apps/mcp-server`) for modularity, independent testing, and dual transport (HTTP+SSE for remote, STDIO for local). Shared business logic lives in `packages/services`, the Drizzle schema in `packages/db`, and email templates in `packages/email`.

### 2.2 Security Model

| Concern | Approach |
|---|---|
| **Authentication** | Neon Auth (Better Auth) — email/password + OAuth (Google, GitHub). Sessions stored in `neon_auth` schema. |
| **Authorization** | Neon RLS with `account_id` on all tenant tables. Middleware protects `/(dashboard)` routes. |
| **Multi-Tenancy** | RLS policies enforce `account_id` filtering at DB level — prevents cross-tenant leakage even with service-layer bugs. |
| **API Auth** | `Authorization: Bearer {key}`. Keys stored as `key_hash` (bcrypt). Scopes enforced per endpoint. |
| **Secret Management** | `.env.local` (dev) + Vercel Environment Variables (prod). BYOK keys AES-256 encrypted at rest in Postgres. Raw keys never logged. |
| **Webhook Security** | Resend webhook HMAC signature validation on every inbound event. |
| **HTTPS** | Enforced everywhere. Vercel provides TLS by default. |
| **Compliance** | CAN-SPAM + GDPR: unsubscribe link in every email, unsubscribes honored promptly, data deletion endpoint per account. |
| **LLM Security** | All prompts server-side only (never exposed to client). Structured templates prevent injection. User context sanitized before injection. All calls logged. |
| **Audit Logging** | `llm_usage_log` for AI calls. `email_events` for Resend events. `api_usage` for developer API calls. |

### 2.3 DevOps Strategy

| Aspect | Decision |
|---|---|
| **Environments** | **Development** (Docker Compose local + Neon dev branch) · **Production** (Vercel + Neon main branch). |
| **Git Branching** | Two branches: `main` (production) and `dev` (development). Feature work branches from `dev` → merges to `dev` → `dev` merges to `main` for release. |
| **CI/CD** | GitHub Actions. Full test suite on every PR to `dev` and `main`. |
| **Deployment** | Vercel auto-deploys `main` to production. Vercel Preview deploys on PRs for visual review. |
| **Docker** | Docker Compose for local dev: `web` (Next.js), `mcp-server`, `postgres` (local PG16). Multi-stage Dockerfiles. |
| **Monitoring** | Vercel Analytics + Vercel Logs. Custom logging to Neon for LLM calls, IMAP errors, webhook events. |
| **Rollback** | Vercel instant rollback. Drizzle migrations forward-only; breaking changes require migration plan. |

**GitHub Actions CI Pipeline** (`.github/workflows/ci.yml`):
1. **lint** — `turbo run lint`
2. **type-check** — `turbo run type-check`
3. **unit-test** — `turbo run test:unit`
4. **integration-test** — `turbo run test:integration` (uses Neon branch DB)
5. **e2e-test** — `turbo run test:e2e` (Playwright against preview deploy)

**GitHub Actions Deploy Pipeline** (`.github/workflows/deploy.yml`):
1. Run full CI suite
2. Vercel auto-deploys `main` (no manual step)
3. Post-deploy smoke test against production URL

### 2.4 Scalability Model

| Dimension | v1 Target |
|---|---|
| **MAU** | ≤10 |
| **Concurrent Users** | ≤5 |
| **Contacts per Account** | ≤50K |
| **Availability** | 99.5% (Vercel + Neon SLAs) |
| **Page Load** | < 2s (P95) |
| **Enrichment** | Async, non-blocking, rate-limited with exponential backoff |
| **Email Sends** | Resend handles delivery scaling; platform batches 20 per variant |
| **LLM Calls** | Gemini 2.5 Pro primary; OpenRouter auto-route fallback |

### 2.5 LLM Strategy

| Aspect | Decision |
|---|---|
| **Where Used** | Template generation, template workshopping (rewrite/shorten/retone), subject line variants, LinkedIn copy, per-contact personalized emails. |
| **Allowed Actions** | Generate/revise email copy, subject lines, CTAs, LinkedIn messages. LLMs do NOT make campaign decisions or modify contact data. |
| **Prompt Engineering** | Structured system prompts stored as MCP Prompt resources. Include tone guidance, token limits, CTA patterns, brand voice. |
| **Safety** | Server-side only. User context sanitized before injection. Output reviewed by user before sending. |
| **Logging** | Every call → `llm_usage_log`: provider, model, input/output tokens, latency, purpose, timestamp. |
| **Routing** | Primary: Gemini 2.5 Pro. Fallback: OpenRouter auto-route. Per-account override. BYOK support. |

---

## 3. Stitch Design Inventory (20 Screens + 2 To Generate)

Each screen is a self-contained HTML/CSS/JS file exported from Stitch. During implementation, we **download each screen's HTML**, extract the markup/styles, and convert them into React (TSX) components that follow the "Luminous Intelligence" design system defined in the Stitch project theme.

| # | Screen Title | Screen ID | Build Phase |
|---|---|---|---|
| 1 | Login / Sign Up | `6e94978cc2294f38a11b498f86997754` | Phase 2 |
| 2 | Dashboard Overview | `0a0c2c02a4894f82b45e3d7484d876c5` | Phase 2 |
| 3 | Upload Contacts — Step 1 | `8c3d87ff4c1f481790b93ab0218f7ea2` | Phase 3 |
| 4 | Enrichment — Step 2 | `42da6815eec94b74be432e51d88484d6` | Phase 3 |
| 5 | Contacts List | `9d02e8bcf1e945159af4c2b7f9f43b62` | Phase 3 |
| 6 | Contact Detail & Analytics | `5ed6967a579d46a49b22303c451f3023` | Phase 3 |
| 7 | Campaign Type Selector | `d36f96e0021b4178bbccd1be2076928a` | Phase 4 |
| 8 | A/B Test: Choose Group | `88b2cc9baf874226954ac4e8dafe2887` | Phase 4 |
| 9 | A/B Test: Subject Test | `a5ac0698ee12432282b786f9cfb4b7f6` | Phase 4 |
| 10 | Template Editor & AI Workshop | `52d58d6317b54068875707b574ffeb5d` | Phase 4 |
| 11 | Campaign Analytics | `33db2a6907254623974154b5da7edcfa` | Phase 4 |
| 12 | Account Settings | `218b36366d8944c19a6a7bd76ae9d5c0` | Phase 2 |
| 13 | Email Journey Builder | `8731ccee36244b52bfb6e2848a48511f` | Phase 5 |
| 14 | Funnel Builder | `ebf0fbb98bb047e7bb096bb611ae767e` | Phase 5 |
| 15 | Forms Dashboard | `2dcbdc967e4045179c2c43f70f324a3f` | Phase 5 |
| 16 | Choose Form Template | `be13ecece39b461a9d64f8e2c47186a1` | Phase 5 |
| 17 | Customize Form | `3c24c7b09e43496c8d3758e73797d32d` | Phase 5 |
| 18 | Get Embed Code | `7a1668be7d4a450fb1ae0270ed37f432` | Phase 5 |
| 19 | Developer: API Keys | `8472ca73754c488380bd691678a8c663` | Phase 7 |
| 20 | Developer: Usage Analytics | `b1a44f14bdcc4c8085265b5884654a12` | Phase 7 |
| — | Newsletter / Blog layout | **TO GENERATE** in Stitch | Phase 5 |
| — | LinkedIn Playbook | **TO GENERATE** in Stitch | Phase 6 |

---

## 4. Monorepo Structure

```
outreachos/
├── .github/
│   └── workflows/
│       ├── ci.yml              # PR gate: lint, type-check, unit, integration, E2E
│       └── deploy.yml          # Post-merge: CI suite + smoke tests
├── apps/
│   ├── web/                    # Next.js 15 App Router (main platform + blog + REST API)
│   │   ├── app/
│   │   │   ├── (auth)/         # Login, Sign Up, OAuth callback
│   │   │   ├── (dashboard)/    # Protected app shell
│   │   │   │   ├── contacts/
│   │   │   │   ├── campaigns/
│   │   │   │   ├── analytics/
│   │   │   │   ├── forms/
│   │   │   │   ├── settings/
│   │   │   │   └── developer/
│   │   │   ├── blog/           # Public blog (generateStaticParams)
│   │   │   └── api/
│   │   │       ├── auth/[...path]/  # Neon Auth handler
│   │   │       ├── contacts/
│   │   │       ├── campaigns/
│   │   │       ├── enrichment/
│   │   │       ├── templates/
│   │   │       ├── experiments/
│   │   │       ├── forms/
│   │   │       ├── webhooks/   # Resend inbound webhooks
│   │   │       ├── cron/       # Vercel Cron endpoints (IMAP polling, etc.)
│   │   │       └── docs/       # OpenAPI 3.1 spec (Phase 4)
│   │   ├── lib/
│   │   │   ├── auth/           # server.ts + client.ts (Neon Auth)
│   │   │   └── hooks/          # TanStack Query hooks
│   │   ├── components/         # React components (converted from Stitch)
│   │   │   ├── ui/             # Design system primitives
│   │   │   ├── layouts/        # Shell, sidebar, nav
│   │   │   └── features/       # Feature-specific composites
│   │   ├── styles/             # Global CSS, design tokens from Stitch theme
│   │   ├── Dockerfile
│   │   └── next.config.ts
│   │
│   └── mcp-server/             # Standalone MCP server package
│       ├── src/
│       │   ├── server.ts       # HTTP+SSE transport
│       │   ├── stdio.ts        # STDIO transport (local dev)
│       │   ├── tools/          # MCP tool handlers
│       │   ├── resources/      # MCP resource handlers
│       │   └── prompts/        # MCP prompt definitions
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── db/                     # Drizzle schema, migrations, db client
│   │   ├── src/
│   │   │   ├── schema/         # All table schemas (per PRD §9)
│   │   │   ├── drizzle.ts      # Neon connection + Drizzle instance
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   └── migrations/
│   │
│   ├── services/               # Shared business logic
│   │   ├── contact-service.ts
│   │   ├── campaign-service.ts
│   │   ├── enrichment-service.ts
│   │   ├── template-service.ts
│   │   ├── experiment-service.ts
│   │   ├── analytics-service.ts
│   │   ├── inbox-service.ts
│   │   ├── form-service.ts
│   │   ├── llm-service.ts      # Gemini 2.5 Pro + OpenRouter routing
│   │   └── index.ts
│   │
│   ├── email/                  # React Email templates + MJML utilities
│   │   └── src/
│   │
│   └── config/                 # Shared TS config, ESLint, constants
│       ├── tsconfig.base.json
│       └── eslint.config.js
│
├── docker-compose.yml          # Local dev: Neon proxy, MCP server, web app
├── Dockerfile                  # Root-level multi-stage build
├── turbo.json
├── package.json
├── .env.example
└── README.md
```

---

## Phase 1 — Project Setup & Environment Foundation

> **Objective:** Fully scaffolded Turborepo monorepo with Docker local dev, Neon database schema deployed, Neon Auth working, CI/CD pipelines live, and design system extracted from Stitch.
>
> **Deliverables:** Bootable monorepo, Docker Compose local dev, Neon schema with RLS, Neon Auth (email/password + OAuth), GitHub Actions CI/CD, design system CSS tokens + base UI primitives.
>
> **Dependencies:** None (greenfield).
>
> **Risks:** Neon Auth is in Beta — monitor for breaking changes. Stitch design token extraction is manual; inconsistencies possible.

### 1.1 Monorepo Bootstrap
- [ ] Initialize Turborepo with `npx create-turbo@latest`
- [ ] Configure `turbo.json` pipelines: `build`, `dev`, `lint`, `type-check`, `test:unit`, `test:integration`, `test:e2e`, `db:push`, `db:generate`
- [ ] Set up shared TypeScript config in `packages/config`
- [ ] Set up shared ESLint config

### 1.2 Next.js App Scaffold
- [ ] Create `apps/web` with `create-next-app` (App Router, TypeScript, Tailwind CSS)
- [ ] Configure `next.config.ts` for Turborepo transpilePackages
- [ ] Set up path aliases (`@/`, `@outreachos/db`, `@outreachos/services`, etc.)

### 1.3 MCP Server Package Scaffold
- [ ] Create `apps/mcp-server` as standalone Node.js/TypeScript package
- [ ] Add placeholder `server.ts` (HTTP+SSE) and `stdio.ts` (STDIO)
- [ ] Wire into Turborepo pipelines

### 1.4 Database Package
- [ ] Create `packages/db`
- [ ] Install `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`
  - Ref: https://orm.drizzle.team/docs/tutorials/drizzle-nextjs-neon
- [ ] Configure `drizzle.config.ts` pointing to Neon connection string
- [ ] Create `src/drizzle.ts` with `drizzle(process.env.DATABASE_URL!)`

### 1.5 Neon Database Schema — Full Deploy
- [ ] Implement complete Drizzle schema matching PRD §9 data model:
  - `accounts`, `contacts`, `contact_groups`, `contact_group_members`
  - `campaigns`, `templates`, `campaign_steps`
  - `experiments`, `experiment_batches`
  - `message_instances`, `email_events`, `replies`
  - `form_templates`, `form_submissions`
  - `linkedin_playbooks`, `llm_usage_log`
  - `api_keys`, `api_usage`, `blog_posts`
- [ ] Enable Neon Row-Level Security (RLS) with `account_id` checks on all tenant tables
- [ ] Run `drizzle-kit generate` + `drizzle-kit push` to deploy schema to Neon
- [ ] Seed script for development data

### 1.6 Docker Local Dev Environment
- [ ] Create root `docker-compose.yml` with services:
  - `web` — Next.js dev server (hot reload via volume mount)
  - `mcp-server` — MCP server dev
  - `postgres` — Local Postgres 16 container (mirrors Neon for offline dev)
- [ ] Create `Dockerfile` for `apps/web` (multi-stage: deps → build → run)
- [ ] Create `Dockerfile` for `apps/mcp-server`
- [ ] Create `.env.example` with all required environment variables
- [ ] Verify `docker compose up` boots all services

### 1.7 Services Package Scaffold
- [ ] Create `packages/services` with TypeScript barrel exports
- [ ] Stub all service files (ContactService, CampaignService, EnrichmentService, TemplateService, ExperimentService, AnalyticsService, InboxService, FormService, LLMService)
- [ ] Wire `@outreachos/db` as a dependency

### 1.8 CI/CD Pipelines
- [ ] Create `.github/workflows/ci.yml`:
  - Trigger: PR to `dev` or `main`
  - Jobs: lint → type-check → unit tests → integration tests → E2E (Playwright)
- [ ] Create `.github/workflows/deploy.yml`:
  - Trigger: push to `main`
  - Jobs: full CI suite → Vercel auto-deploy → post-deploy smoke test
- [ ] Configure Vercel project: auto-deploy `main`, preview deploys on PRs
- [ ] Set up Vercel Environment Variables for production

### 1.9 Design System Foundation
- [ ] Extract design tokens from Stitch project theme into CSS custom properties:
  - Colors: `--surface-dim: #131318`, `--primary: #C4C0FF`, `--secondary: #41EEC2`, etc.
  - Typography: Inter (headlines/body), JetBrains Mono (technical/code elements)
  - Spacing scale, border radius (10px cards), glassmorphism utilities
  - "No-Line Rule" — no 1px borders; use background color shifts and negative space
  - "Ghost Border" — `outline-variant` at 15% opacity only when accessibility requires
- [ ] Set up Tailwind CSS config extending with Stitch design tokens
- [ ] Create base UI primitives (`Button`, `Card`, `Input`, `Badge`, `Table`, `Modal`) by converting Stitch HTML/CSS patterns to React TSX components

### 1.10 Shared State Setup
- [ ] Install TanStack Query v5 in `apps/web`
- [ ] Create `QueryClientProvider` wrapper in app layout
- [ ] Install Zustand; create initial UI store (sidebar state, active account, etc.)

### 1.11 Phase 1 Testing
- [ ] Unit tests for Drizzle schema (table definitions, relations)
- [ ] Integration test: DB connection, seed script, RLS policy verification
- [ ] CI pipeline runs green on first PR
- [ ] Docker Compose boots end-to-end locally
- [ ] `log.md` created with Phase 1 architecture decisions

---

## Phase 2 — Authentication & Access Control

> **Objective:** Working auth flow (email/password + Google/GitHub OAuth), protected dashboard shell, and account settings page. User can sign up, log in, see an empty dashboard, and access settings.
>
> **Deliverables:** Login/Sign Up pages (Stitch screens #1), Dashboard shell with sidebar (Stitch screen #2), Account Settings page (Stitch screen #12), auth middleware protecting all `/(dashboard)` routes.
>
> **Dependencies:** Phase 1 complete (monorepo, DB schema, design system).
>
> **Risks:** Neon Auth Beta — Google OAuth works out-of-box in dev mode; GitHub requires custom OAuth app credentials.

### 2.1 Stitch Design Conversion — Auth & Shell (3 screens)
- [ ] Convert **Login / Sign Up** (Stitch `6e94978cc2294f38a11b498f86997754`) → `/(auth)/login`, `/(auth)/signup`
- [ ] Convert **Dashboard Overview** (Stitch `0a0c2c02a4894f82b45e3d7484d876c5`) → `/(dashboard)` shell layout (sidebar, top bar, summary cards placeholder)
- [ ] Convert **Account Settings** (Stitch `218b36366d8944c19a6a7bd76ae9d5c0`) → `/(dashboard)/settings`

### 2.2 Neon Auth Integration
- [ ] Install `@neondatabase/auth`
  - Ref: https://neon.com/docs/auth/quick-start/nextjs
- [ ] Create `lib/auth/server.ts` with `createNeonAuth()` configuration
- [ ] Create `lib/auth/client.ts` with `createAuthClient()`
- [ ] Set up API route: `app/api/auth/[...path]/route.ts` → `auth.handler()`
- [ ] Set up middleware (`middleware.ts`) to protect `/(dashboard)` routes
- [ ] Configure OAuth providers (Google dev mode out-of-box; GitHub requires custom credentials)
  - Ref: https://neon.com/docs/auth/guides/setup-oauth
- [ ] Wire sign-in/sign-up forms to `authClient.signIn.email()`, `authClient.signUp.email()`, `authClient.signIn.social()`

### 2.3 Account Settings Page
- [ ] Connected email (IMAP/SMTP credentials: host, port, TLS, username, password) — UI only, backend wired in Phase 5
- [ ] LLM model preference (Gemini / OpenRouter) — UI scaffold
- [ ] Default sender domain
- [ ] BYOK key management — UI scaffold (full backend in Phase 6)
- [ ] Accessible from every screen via sidebar nav

### 2.4 Phase 2 Testing
- [ ] Unit tests: auth server instance creation, middleware route protection
- [ ] Integration tests: sign-up → login → session → protected route access
- [ ] E2E (Playwright): full sign-up → login → dashboard → settings flow
- [ ] OAuth flow tested (Google dev mode)
- [ ] Update `log.md` with auth decisions

---

## Phase 3 — Contact Management & Enrichment

> **Objective:** Full contact upload → enrichment → review pipeline. User can upload CSV/XLS, enrich via Hunter.io, review contacts in a table, assign groups, export, and view per-contact analytics.
>
> **Deliverables:** Upload Contacts page (Stitch #3), Enrichment page (Stitch #4), Contacts List (Stitch #5), Contact Detail & Analytics (Stitch #6), ContactService, EnrichmentService, Hunter.io integration.
>
> **Dependencies:** Phase 2 complete (auth, dashboard shell, settings).
>
> **Risks:** Hunter.io API rate limits (15 req/s on free plan). Large CSV uploads may hit Vercel function timeout — consider chunked processing.

### 3.1 Stitch Design Conversion — Contact Screens (4 screens)
- [ ] Convert **Upload Contacts — Step 1** (Stitch `8c3d87ff4c1f481790b93ab0218f7ea2`) → `/(dashboard)/contacts/upload`
- [ ] Convert **Enrichment — Step 2** (Stitch `42da6815eec94b74be432e51d88484d6`) → `/(dashboard)/contacts/enrich`
- [ ] Convert **Contacts List** (Stitch `9d02e8bcf1e945159af4c2b7f9f43b62`) → `/(dashboard)/contacts`
- [ ] Convert **Contact Detail & Analytics** (Stitch `5ed6967a579d46a49b22303c451f3023`) → `/(dashboard)/contacts/[id]`

### 3.2 Contact Management
- [ ] **CSV/XLS Upload endpoint** (`POST /api/contacts/upload`)
  - Accept `.csv`, `.xlsx`, `.xls` via multipart upload
  - Validate required columns: `FirstName`, `LastName`, `BusinessWebsite`, `CompanyName`
  - Return per-row error report on validation failure
  - Use `xlsx` npm package for Excel parsing
- [ ] **Contact CRUD** — TanStack Query hooks for list, create, update, delete
- [ ] **Contact Groups** — assign group name on review screen, many-to-many via `contact_group_members`
- [ ] **Contact Export** — `GET /api/contacts/export?group_id=X&format=csv`
- [ ] **Custom Fields** — JSONB `custom_fields` column, editable via inline edit

### 3.3 Hunter.io Enrichment Pipeline
- [ ] **EnrichmentService** in `packages/services`:
  - Email Finder: `GET https://api.hunter.io/v2/email-finder` with domain + first_name + last_name
    - Ref: https://hunter.io/api/email-finder
  - Email Verifier: `GET https://api.hunter.io/v2/email-verifier` per returned email
    - Ref: https://hunter.io/api-documentation
  - Inclusion threshold: `confidence >= 80` AND `status ∈ {valid, accept_all}`
  - Store: `hunter_score`, `hunter_status`, `linkedin_url`, `hunter_sources[]`, `enriched_at`
- [ ] **Rate-limit handling** — exponential backoff with retry queue
- [ ] **Batch processing endpoint** (`POST /api/enrichment/batch`) — accepts group_id, processes sequentially
- [ ] **Progress tracking** — SSE endpoint or polling for enrichment progress bar per group
- [ ] **Re-run enrichment** on single contact or entire group

### 3.4 Contact Analytics Page
- [ ] Per-contact: emails sent, opens (total + per-message), soft/hard bounces, complaints, unsubscribes
- [ ] Time-of-day histogram of opens
- [ ] Day-of-week distribution
- [ ] Per-message: open count, first/last open timestamp
- [ ] Active journey memberships (wired when journeys built in Phase 5)
- [ ] Reply history, custom field values

### 3.5 Phase 3 Testing
- [ ] Unit tests: ContactService CRUD, EnrichmentService (mocked Hunter.io responses)
- [ ] Integration tests: CSV upload → parse → DB insert → enrichment → contact record update
- [ ] E2E (Playwright): upload CSV → enrich → view contacts list → contact detail
- [ ] Hunter.io rate-limit and error handling tests
- [ ] Update `log.md`

---

## Phase 4 — Campaigns, Templates & Experimentation Engine

> **Objective:** Campaign creation, template editor with LLM workshop, email delivery via Resend, A/B subject line experimentation, webhook ingestion, and campaign analytics. First emails sent.
>
> **Deliverables:** Campaign Type Selector (Stitch #7), A/B Test screens (Stitch #8, #9), Template Editor (Stitch #10), Campaign Analytics (Stitch #11), CampaignService, TemplateService, ExperimentService, AnalyticsService, LLMService (Gemini 2.5 Pro), Resend integration.
>
> **Dependencies:** Phase 3 complete (contacts exist and are enriched).
>
> **Risks:** Resend domain verification can take 24-48h. Gemini API quota limits on free tier. MJML/React Email rendering quirks across email clients.

### 4.1 Stitch Design Conversion — Campaign Screens (5 screens)
- [ ] Convert **Campaign Type Selector** (Stitch `d36f96e0021b4178bbccd1be2076928a`) → `/(dashboard)/campaigns/new`
- [ ] Convert **A/B Test: Choose Group** (Stitch `88b2cc9baf874226954ac4e8dafe2887`) → `/(dashboard)/campaigns/ab-test/setup`
- [ ] Convert **A/B Test: Subject Test** (Stitch `a5ac0698ee12432282b786f9cfb4b7f6`) → `/(dashboard)/campaigns/ab-test/[id]/subject`
- [ ] Convert **Template Editor & AI Workshop** (Stitch `52d58d6317b54068875707b574ffeb5d`) → `/(dashboard)/templates/[id]/edit`
- [ ] Convert **Campaign Analytics** (Stitch `33db2a6907254623974154b5da7edcfa`) → `/(dashboard)/campaigns/[id]/analytics`

### 4.2 Email Delivery via Resend
- [ ] **Resend integration** in `packages/services`:
  - `POST https://api.resend.com/emails` for sending
    - Ref: https://resend.com/docs/api-reference/emails/send-email
  - Domain verification setup guide in README
- [ ] **One-Time Campaign send flow**:
  - Template mode: shared template with token replacement per contact
  - Individual mode: LLM generates fully personalized email per contact
  - Schedule send or send immediately
- [ ] **Resend Webhook ingestion** (`POST /api/webhooks/resend`):
  - HMAC signature validation on every inbound event
  - Event types: `delivered`, `opened`, `clicked`, `soft_bounce`, `hard_bounce`, `complained`, `unsubscribed`
  - Persist to `email_events` table
  - Update `message_instances.status` accordingly
- [ ] **Unsubscribe handling**: mark contact `unsubscribed = true`, remove from all active campaigns
- [ ] **Deliverability monitoring**: auto-pause campaign if complaint rate > 0.1%

### 4.3 Template Editor
- [ ] **Import endpoint** (`POST /api/templates/import`):
  - Accept `.txt`, `.md`, `.docx`
  - `.docx` parsed via Mammoth.js → HTML — Ref: https://github.com/mwilliamson/mammoth.js
- [ ] **Template Editor UI** (from Stitch screen #10):
  - Rich text editing with curated font selection (Inter, Georgia, Courier)
  - Bold, italic, underline, bullet lists, hyperlinks
  - Styles compile to inline CSS for email client compatibility
  - React Email / MJML rendering pipeline — Ref: https://react.email/docs/introduction · https://mjml.io/documentation/
- [ ] **Token / merge tag system**:
  - Built-in tokens: `{FirstName}`, `{LastName}`, `{CompanyName}`, `{BusinessWebsite}`, `{City}`, `{State}`
  - Custom field tokens from contact record
  - Token picker UI with `{` autocomplete
  - Fallback configuration per token
  - Preview mode with sample/real contact data
- [ ] **LLM Workshop panel** (side panel):
  - User enters instruction → Gemini 2.5 Pro generates revised version — Ref: https://ai.google.dev/gemini-api/docs
  - Accept/reject/merge suggestions
  - Version history with rollback
- [ ] **Subject line suggestions**: LLM generates 3 variants
- [ ] **Multi-variant save** for A/B testing

### 4.4 LLM Service (Gemini 2.5 Pro)
- [ ] **LLMService** in `packages/services`:
  - Primary: Gemini 2.5 Pro via Google AI Studio API — Ref: https://ai.google.dev/gemini-api/docs · https://ai.google.dev/api
  - Structured prompt construction for email generation (goal, audience, tone, CTA)
  - All calls logged to `llm_usage_log` (provider, model, input/output tokens, latency)
- [ ] **Template generation from prompt** endpoint (`POST /api/templates/generate`)

### 4.5 A/B Experimentation Engine
- [ ] **ExperimentService** in `packages/services`:
  - Create experiment entity per PRD §6.5 schema
  - **Subject Line Test (Phase 1 of A/B)**:
    - Split contacts: 20 per variant per batch
    - Subject lines ≤ 6 words, identical body/CTA
    - Winner: `>=40% open rate` for **2 consecutive campaigns**
    - On promotion → champion subject locked
  - **Send Time Optimization** (parallel track):
    - Track open rate by hour-of-day × day-of-week
    - Gradually bias future sends toward best windows
- [ ] **Experiment log** — persist every variant, batch, metrics, decision rationale
- [ ] **Batch send orchestration** — schedule and dispatch 20-contact batches via Resend

### 4.6 Campaign Analytics Page
- [ ] **AnalyticsService** in `packages/services`:
  - Aggregate from `email_events` table (sourced from Resend webhooks)
  - Compute: sent/delivered/failed, open rate, unique opens, bounce rates, complaint rate, unsubscribe rate
- [ ] **Campaign Analytics UI** (from Stitch screen #11):
  - Time-of-day heatmap (24h grid)
  - Day-of-week chart
  - Variant breakdown (side-by-side A/B stats)
  - Experiment log with champion promotions
  - Contact drill-down (click metric → see contributing contacts)

### 4.7 Phase 4 Testing
- [ ] Unit tests: CampaignService, TemplateService, ExperimentService, AnalyticsService, LLMService
- [ ] Integration tests: create campaign → build template → send batch → webhook ingestion → analytics computation
- [ ] E2E (Playwright): campaign creation → template editor → A/B setup → send → view analytics
- [ ] Resend webhook HMAC validation tests
- [ ] LLM template generation quality tests
- [ ] Update `log.md`

---

## Phase 5 — Journeys, Funnels, Inbox, Forms & SEO

> **Objective:** Multi-step email workflows, reply tracking, forms with embedding, blog/newsletter, and A/B body/CTA test completion. Full multi-step outbound pipeline operational.
>
> **Deliverables:** Email Journey Builder (Stitch #13), Funnel Builder (Stitch #14), Forms screens (Stitch #15–18), Newsletter/Blog layouts (TO GENERATE in Stitch), InboxService, FormService, JourneyService, FunnelService, blog CMS, newsletter send flow.
>
> **Dependencies:** Phase 4 complete (campaigns sending, templates working, Resend webhooks ingesting).
>
> **Risks:** IMAP polling in Vercel serverless has 60s function timeout — must be efficient. Gmail API OAuth for leads labeling requires Google Cloud project setup. Blog SEO indexing depends on Vercel CDN config.

### 5.0 Generate Missing Stitch Designs
Before starting Phase 5 frontend work:
- [ ] **Generate Newsletter / Blog layout** in Stitch project `13517806960470855745`
  - Newsletter template preview, blog post page, blog listing, subscribe widget
- [ ] Finalize designs and export HTML for conversion

### 5.1 Stitch Design Conversion — Phase 5 Screens (6 existing + new)
- [ ] Convert **Email Journey Builder** (Stitch `8731ccee36244b52bfb6e2848a48511f`) → `/(dashboard)/campaigns/journey/[id]`
- [ ] Convert **Funnel Builder** (Stitch `ebf0fbb98bb047e7bb096bb611ae767e`) → `/(dashboard)/campaigns/funnel/[id]`
- [ ] Convert **Forms Dashboard** (Stitch `2dcbdc967e4045179c2c43f70f324a3f`) → `/(dashboard)/forms`
- [ ] Convert **Choose Form Template** (Stitch `be13ecece39b461a9d64f8e2c47186a1`) → `/(dashboard)/forms/new`
- [ ] Convert **Customize Form** (Stitch `3c24c7b09e43496c8d3758e73797d32d`) → `/(dashboard)/forms/[id]/edit`
- [ ] Convert **Get Embed Code** (Stitch `7a1668be7d4a450fb1ae0270ed37f432`) → `/(dashboard)/forms/[id]/embed`
- [ ] Convert **Newsletter / Blog** (newly generated) → `/(dashboard)/newsletters`, `/blog`, `/blog/[slug]`

### 5.2 Email Journey Engine
- [ ] **Journey state machine** per contact:
  `enrolled → initial_sent → first_followup_sent → second_followup_sent → hail_mary_sent → completed | removed`
- [ ] 4 named steps: Initial, 1st Follow Up, 2nd Follow Up, Hail Mary
- [ ] Each step: separate template (subject, body, CTA), configurable day/time
- [ ] Auto-removal triggers (toggleable): remove on unsubscribe, remove on reply
- [ ] Journey scheduling via Vercel Cron — Ref: https://vercel.com/docs/cron-jobs

### 5.3 A/B Body/CTA Test Phase + Production State
- [ ] **Body & CTA Test**:
  - Lock champion subject line from Phase 4
  - Two body variants: exactly 2 paragraphs + CTA each
  - Winner: `>=3% response rate` for 2 consecutive campaigns
- [ ] **Production state**: both subject + body/CTA champions confirmed → all contacts get champion template at champion send time
- [ ] **Ongoing challenger tests**: 10% of batches use challenger variant indefinitely

### 5.4 IMAP/SMTP Inbox Integration
- [ ] **InboxService** in `packages/services`:
  - IMAP connection via `node-imap` — Ref: https://github.com/mscdex/node-imap
  - SMTP via Nodemailer — Ref: https://nodemailer.com/
- [ ] **IMAP polling worker** — Vercel Cron endpoint every 5 minutes — Ref: https://vercel.com/docs/cron-jobs
- [ ] **Reply detection**: match `In-Reply-To` / `References` headers against Resend outbound message IDs
- [ ] On match: mark contact `replied`, store reply timestamp, update response rate
- [ ] **Gmail leads label**: create/apply "leads" label via Gmail API OAuth — Ref: https://www.labnol.org/code/create-gmail-labels-200201
- [ ] **Non-Gmail IMAP**: user configures destination folder in settings; platform copies matched message

### 5.5 Email Campaign Funnel
- [ ] Built on Journey engine with entry conditions:
  - "Did not open campaign X"
  - "Opened campaign X more than 5 times"
  - "Replied to campaign X"
  - "Filled out contact form Y"
- [ ] Behavioral funnels: up to 4 sequential emails
- [ ] Form-based funnels: variable email count, full template control per step

### 5.6 Forms Module
- [ ] **FormService** in `packages/services`
- [ ] 5 pre-built HTML/CSS form templates (minimal, modal, inline banner, multi-step wizard, side drawer)
- [ ] Field types: text, email, phone, dropdown, checkbox, textarea, hidden
- [ ] Required/optional field configuration
- [ ] **HTML/CSS editor** in platform UI (Stitch screen #17)
- [ ] **Embedding**:
  - Hosted link: `app.outreachos.com/f/{form_id}`
  - Widget/iframe snippet generator (Stitch screen #18)
- [ ] **Form-to-Automation**: map form → journey/funnel, create/update contact on submission
- [ ] Form submission analytics

### 5.7 Blog / SEO Module
- [ ] **Blog CMS**: markdown-based, fields: slug, title, tags, author, published_at, meta_description, og_image
- [ ] Blog rendering via Next.js App Router with `generateStaticParams` — Ref: https://nextjs.org/docs/app
- [ ] Deployed on Vercel for edge CDN
- [ ] **Newsletter subscribe widget** embeddable on blog posts
- [ ] Newsletter subscribers auto-added to `newsletter_subscriber` contact group

### 5.8 Newsletter Send Flow
- [ ] Segment: contacts tagged `newsletter_subscriber`
- [ ] Newsletter template type: richer layout (headers, sections, images, links)
- [ ] One-off or scheduled recurring sends
- [ ] Newsletter links to or embeds latest blog content

### 5.9 Phase 5 Testing
- [ ] Unit tests: JourneyService, FunnelService, InboxService, FormService
- [ ] Integration test: form submission → contact creation → funnel enrollment → email sends
- [ ] E2E: journey flow end-to-end with mocked IMAP
- [ ] Reply detection accuracy tests
- [ ] Blog SEO: verify meta tags, OG images, sitemap generation
- [ ] Update `log.md`

---

## Phase 6 — Agent Layer, LinkedIn & BYOK

> **Objective:** MCP server live with all tools/resources/prompts, LinkedIn Playbook, OpenRouter fallback, BYOK key management, and agent-writable custom fields.
>
> **Deliverables:** MCP server (HTTP+SSE + STDIO), LinkedIn Playbook screen (TO GENERATE in Stitch), all 21 MCP tools, 4 MCP resources, 3 MCP prompts, OpenRouter integration, BYOK encrypted key storage.
>
> **Dependencies:** Phase 5 complete (all campaign types operational, inbox integration working).
>
> **Risks:** MCP protocol is evolving — pin to a stable spec version. OpenRouter model availability varies. AES-256 key management must be audited.

### 6.0 Generate Missing Stitch Designs
- [ ] **Generate LinkedIn Playbook screen** in Stitch project `13517806960470855745`
  - Per-contact/group generated message copy, prompt config, status
- [ ] Export and convert to React components

### 6.1 MCP Server — Full Implementation
- [ ] **HTTP+SSE transport** (`apps/mcp-server/src/server.ts`)
  - Ref: https://modelcontextprotocol.io/docs/learn/architecture · https://modelcontextprotocol.io/docs/learn/server-concepts
- [ ] **STDIO transport** for local development (`apps/mcp-server/src/stdio.ts`)
- [ ] **MCP Tools** (write/action) — implement all 21 tools from PRD §6.10:
  - Campaign: `list_campaigns`, `get_campaign_details`, `start_campaign`, `pause_campaign`, `stop_campaign`, `duplicate_campaign`
  - Templates: `create_campaign_template`, `generate_template_from_prompt`, `update_campaign_template`
  - Analytics: `get_campaign_stats`
  - Contacts: `enrich_contacts`, `export_contacts`, `push_contact_field`, `pull_contact_field`, `list_contact_groups`, `create_contact_group`, `add_contacts_to_group`
  - LinkedIn: `generate_linkedin_copy`, `get_linkedin_playbook`
  - Account: `list_accounts`, `set_active_account`
  - Experiments: `list_ab_experiments`, `get_experiment_log`
- [ ] **MCP Resources** (read-only):
  - `campaign_performance_summary`, `contact_schema`, `recent_replies_summary`, `experiment_status`
- [ ] **MCP Prompts**:
  - `email_drafting_prompt`, `linkedin_copy_prompt`, `follow_up_sequence_prompt`
- [ ] **Multi-account context**: every call includes `account_id` or uses active account from `set_active_account`

### 6.2 LinkedIn Playbook
- [ ] **LinkedIn copy generation** via LLM using: contact data + LinkedIn URL + research notes + custom prompt
- [ ] Store as `linkedin_playbooks` records per contact/group
- [ ] Surface in platform UI (from newly generated Stitch screen)
- [ ] MCP tools: `generate_linkedin_copy`, `get_linkedin_playbook`
- [ ] Future-ready: `record_linkedin_response` input for optimization

### 6.3 OpenRouter Integration + LLM Routing
- [ ] **LLMService update** — implement routing abstraction per PRD §10:
  - `primary_provider`: gemini (default)
  - `fallback_provider`: openrouter
  - `routing_mode`: auto | manual
  - Ref: https://openrouter.ai/docs/guides/guides/mcp-servers
- [ ] Per-account model override in settings
- [ ] All LLM calls logged regardless of provider

### 6.4 BYOK Key Management
- [ ] **Encrypted storage** — AES-256 encryption at rest for all BYOK keys
- [ ] BYOK for: Hunter.io, Resend, Gemini, OpenRouter
- [ ] Platform-managed key as default (metered against account usage quota)
- [ ] **Settings UI update** — full BYOK key management section wired to backend
- [ ] Platform never logs raw key values

### 6.5 Agent-Writable Custom Contact Fields
- [ ] `push_contact_field` / `pull_contact_field` via MCP + REST API
- [ ] Writes to `contacts.custom_fields` JSONB column
- [ ] Validation and schema awareness

### 6.6 Phase 6 Testing
- [ ] MCP tool integration tests — every tool exercised
- [ ] Multi-account isolation tests
- [ ] BYOK encryption/decryption round-trip tests
- [ ] LinkedIn copy generation quality tests
- [ ] LLM routing failover tests (Gemini down → OpenRouter)
- [ ] Update `log.md`

---

## Phase 7 — Developer API, Billing & Hardening

> **Objective:** Productize as a developer-facing platform with REST API, API key management, usage tracking, outbound webhooks, billing abstraction, and final security hardening.
>
> **Deliverables:** Developer: API Keys (Stitch #19), Developer: Usage Analytics (Stitch #20), REST API mirroring MCP tools, OpenAPI 3.1 docs, API key management, usage dashboard, outbound webhooks, billing data model.
>
> **Dependencies:** Phase 6 complete (MCP server working, all services operational).
>
> **Risks:** OpenAPI spec generation must stay in sync with API routes. Rate limiting tuning requires production traffic data.

### 7.1 Stitch Design Conversion — Developer Screens (2 screens)
- [ ] Convert **Developer: API Keys** (Stitch `8472ca73754c488380bd691678a8c663`) → `/(dashboard)/developer/keys`
- [ ] Convert **Developer: Usage Analytics** (Stitch `b1a44f14bdcc4c8085265b5884654a12`) → `/(dashboard)/developer/usage`

### 7.2 REST API Surface
- [ ] RESTful endpoints mirroring every MCP tool (PRD §6.11)
- [ ] Auth: `Authorization: Bearer {key}` header
- [ ] Auto-generated **OpenAPI 3.1 spec** at `/api/docs`
- [ ] Rate limiting: configurable per account/plan

### 7.3 API Key Management
- [ ] Create, revoke, label, scope API keys
- [ ] `api_keys` table: `key_hash` (bcrypt), `scopes` (JSONB), `last_used_at`
- [ ] UI from Stitch screen #19

### 7.4 Usage Tracking
- [ ] Per-key, per-endpoint: call count, LLM tokens, Hunter credits, Resend sends
- [ ] `api_usage` table aggregation
- [ ] Usage dashboard UI from Stitch screen #20

### 7.5 Outbound Webhooks
- [ ] Developer-registered webhook URLs
- [ ] Events: send, open, reply, bounce, etc.
- [ ] Retry logic with exponential backoff

### 7.6 Billing Abstraction
- [ ] Platform-managed key metering per account
- [ ] Billing data model ready for Stripe integration
- [ ] Usage quota enforcement

### 7.7 Security Hardening
- [ ] Full security audit: RLS policies, HMAC validation, BYOK encryption, API key scoping
- [ ] CAN-SPAM / GDPR compliance: unsubscribe link in every email verified, data deletion endpoint tested
- [ ] Penetration testing on API endpoints
- [ ] Verify no cross-tenant data leakage under all access patterns

### 7.8 Phase 7 Testing
- [ ] API endpoint tests for all REST routes
- [ ] API key auth + scope enforcement tests
- [ ] Rate limiting tests
- [ ] Usage tracking accuracy tests
- [ ] Webhook delivery reliability tests
- [ ] Full regression suite across all phases
- [ ] Update `log.md`

---

## 5. Reference Links Index

**Core App**
- Next.js App Router: https://nextjs.org/docs/app
- Next.js Docs: https://nextjs.org/docs
- Neon + Next.js Guide: https://neon.com/docs/guides/nextjs
- Vercel + Next.js: https://vercel.com/docs/frameworks/full-stack/nextjs
- Next.js Database Tutorial: https://nextjs.org/learn/dashboard-app/setting-up-your-database

**Auth**
- Neon Auth Overview: https://neon.com/docs/auth/overview
- Neon Auth Next.js Quick Start: https://neon.com/docs/auth/quick-start/nextjs
- Neon Auth OAuth Setup: https://neon.com/docs/auth/guides/setup-oauth

**Database & ORM**
- Neon Introduction: https://neon.com/docs/introduction
- Drizzle + Neon + Next.js: https://orm.drizzle.team/docs/tutorials/drizzle-nextjs-neon

**Email Delivery**
- Resend API Intro: https://resend.com/docs/api-reference/introduction
- Resend Send Email: https://resend.com/docs/api-reference/emails/send-email
- Resend Docs Index: https://resend.com/docs/llms.txt

**Contact Enrichment**
- Hunter API Overview: https://hunter.io/api
- Hunter API Docs: https://hunter.io/api-documentation
- Hunter Email Finder: https://hunter.io/api/email-finder
- Hunter Help: https://help.hunter.io/en/articles/1970956-hunter-api

**AI / LLM**
- Gemini API Docs: https://ai.google.dev/gemini-api/docs
- Gemini API Reference: https://ai.google.dev/api
- OpenRouter MCP Guide: https://openrouter.ai/docs/guides/guides/mcp-servers

**MCP / Agent Layer**
- MCP Architecture: https://modelcontextprotocol.io/docs/learn/architecture
- MCP Server Concepts: https://modelcontextprotocol.io/docs/learn/server-concepts

**Email Templates**
- React Email Intro: https://react.email/docs/introduction
- React Email Manual Setup: https://react.email/docs/getting-started/manual-setup
- React Email Auto Setup: https://react.email/docs/getting-started/automatic-setup
- MJML Docs: https://mjml.io/documentation/
- MJML Home: https://mjml.io

**Inbox / Reply Handling**
- node-imap: https://github.com/mscdex/node-imap
- Gmail Labels API: https://www.labnol.org/code/create-gmail-labels-200201
- Nodemailer: https://nodemailer.com/

**File Parsing**
- Mammoth.js: https://github.com/mwilliamson/mammoth.js

**Scheduling**
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel Cron Guide: https://vercel.com/kb/guide/how-to-setup-cron-jobs-on-vercel

**Design Source**
- Google Stitch: https://stitch.withgoogle.com/
- Stitch Project ID: `13517806960470855745`
