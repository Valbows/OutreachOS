FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# --- Development ---
FROM base AS dev
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/db/package.json ./packages/db/
COPY packages/services/package.json ./packages/services/
COPY packages/eslint-config/ ./packages/eslint-config/
COPY packages/typescript-config/ ./packages/typescript-config/
RUN pnpm install --frozen-lockfile
COPY . .
CMD ["pnpm", "turbo", "run", "dev", "--filter=@outreachos/mcp-server"]

# --- Production ---
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .gitignore ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/db/package.json ./packages/db/
COPY packages/services/package.json ./packages/services/
COPY packages/eslint-config/ ./packages/eslint-config/
COPY packages/typescript-config/ ./packages/typescript-config/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm turbo run build --filter=@outreachos/mcp-server

# Prune to production dependencies only
RUN pnpm prune --prod --no-optional

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 mcpuser

# Root pnpm workspace metadata for module resolution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# App package — package.json + built dist + local node_modules (workspace symlinks)
COPY --from=builder /app/apps/mcp-server/package.json ./apps/mcp-server/
COPY --from=builder /app/apps/mcp-server/dist ./apps/mcp-server/dist
COPY --from=builder /app/apps/mcp-server/node_modules ./apps/mcp-server/node_modules

# Workspace packages — package.json (for main/exports) + built dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/services/package.json ./packages/services/
COPY --from=builder /app/packages/services/dist ./packages/services/dist

# Hoisted npm dependencies (drizzle-orm, @neondatabase/serverless, etc.)
COPY --from=builder /app/node_modules ./node_modules

USER mcpuser
EXPOSE 3001
WORKDIR /app/apps/mcp-server

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
