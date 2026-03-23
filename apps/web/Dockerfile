FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# --- Development ---
FROM base AS dev
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/services/package.json ./packages/services/
COPY packages/eslint-config/ ./packages/eslint-config/
COPY packages/typescript-config/ ./packages/typescript-config/
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "turbo", "run", "dev", "--filter=@outreachos/web"]

# --- Builder ---
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/services/package.json ./packages/services/
COPY packages/eslint-config/ ./packages/eslint-config/
COPY packages/typescript-config/ ./packages/typescript-config/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm turbo run build --filter=@outreachos/web

# --- Production ---
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
