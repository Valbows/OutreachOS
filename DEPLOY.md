# OutreachOS Deployment Guide

## Vercel Deployment (Production)

The blog and entire OutreachOS app are configured for **Vercel edge CDN** deployment.

### One-Time Setup

1. **Install Vercel CLI** (optional, for command-line deploys):
   ```bash
   npm i -g vercel
   ```

2. **Connect GitHub Repo to Vercel**:
   - Go to https://vercel.com/new
   - Import `Valbows/OutreachOS` repository
   - Select `apps/web` as the root directory **(or leave empty — `vercel.json` handles it)**
   - Framework: **Next.js** (auto-detected)
   - Build Command: `pnpm --filter @outreachos/web build` (auto from `vercel.json`)
   - Install Command: `pnpm install --frozen-lockfile` (auto from `vercel.json`)

3. **Set Environment Variables** in Vercel Dashboard:
   ```
   DATABASE_URL=<your Neon database URL>
   NEON_AUTH_API_KEY=<from Neon Auth>
   RESEND_API_KEY=<from Resend>
   RESEND_WEBHOOK_SECRET=<Resend webhook secret>
   GEMINI_API_KEY=<Google Gemini API key>
   NEXT_PUBLIC_APP_URL=https://app.outreachos.com
   CRON_SECRET=<random secret for cron auth>
   ```

4. **Configure Custom Domain** (optional):
   - Add `app.outreachos.com` in Vercel > Settings > Domains
   - Update DNS CNAME to point to Vercel

### Cron Jobs

`vercel.json` already configures these scheduled cron jobs:

| Path                              | Schedule      | Purpose                            |
| --------------------------------- | ------------- | ---------------------------------- |
| `/api/cron/journey-scheduler`     | Every 15 min  | Execute scheduled journey steps    |
| `/api/cron/inbox-poll`            | Every 5 min   | Poll IMAP inboxes for replies      |
| `/api/cron/newsletter-send`       | Every 10 min  | Process queued newsletter sends    |

### Blog ISR Caching

Blog routes use Incremental Static Regeneration:
- `/blog` → revalidates every 60s
- `/blog/[slug]` → revalidates every 60s
- Cache-Control headers set in `vercel.json` for edge CDN:
  - `s-maxage=60` (CDN cache: 60s)
  - `stale-while-revalidate=3600` (serve stale up to 1hr while revalidating)

### Deploy via CLI (alternative)

```bash
# From repo root
vercel --prod
```

### Verify Deployment

After deploy:
1. Visit `https://your-app.vercel.app/blog` — blog listing page
2. Visit `https://your-app.vercel.app/blog/[any-slug]` — blog post page
3. Check Vercel Dashboard > Cron Jobs — confirm 3 crons are listed
4. Check Vercel Dashboard > Functions > Edge — confirm edge CDN caching active

## Database Setup

Before first deploy:

```bash
# Setup RLS policies on Neon
pnpm --filter @outreachos/db db:setup-rls

# Push schema to DB
pnpm --filter @outreachos/db db:push
```

## Troubleshooting

- **Build fails on `pnpm install`**: Ensure Vercel uses Node 20+ (set in Project Settings > General > Node.js Version)
- **Crons not firing**: Check `CRON_SECRET` env var is set and matches your cron handlers
- **Blog 404s**: Ensure `BlogService.getAllSlugs()` returns data — check DB connection
