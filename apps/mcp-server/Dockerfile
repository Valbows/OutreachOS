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
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/db/package.json ./packages/db/
COPY packages/services/package.json ./packages/services/
COPY packages/eslint-config/ ./packages/eslint-config/
COPY packages/typescript-config/ ./packages/typescript-config/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm turbo run build --filter=@outreachos/mcp-server

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 mcpuser
COPY --from=builder /app/apps/mcp-server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER mcpuser
EXPOSE 3001
CMD ["node", "dist/server.js"]
