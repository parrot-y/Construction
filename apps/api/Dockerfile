# Multi-stage Dockerfile for MjengoLedger API (@construction/api)
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate
WORKDIR /app

# Dependencies stage
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/money/package.json ./packages/money/
COPY packages/permissions/package.json ./packages/permissions/
COPY packages/validation/package.json ./packages/validation/
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY --from=dependencies /app/apps ./apps
COPY . .
RUN pnpm --filter @construction/permissions run build || true
RUN pnpm --filter @construction/money run build || true
RUN pnpm --filter @construction/validation run build || true
RUN pnpm --filter @construction/db run prisma:generate
RUN pnpm --filter @construction/db run build
RUN pnpm --filter @construction/api run build

# Production runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Add non-root user for security hardening
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/apps/api ./apps/api
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

USER nodejs
EXPOSE 3001

WORKDIR /app/apps/api
CMD ["pnpm", "start"]
