# Multi-stage Dockerfile for Platform Web PWA (@construction/web)
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@12.16.1 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/money/package.json ./packages/money/
COPY packages/permissions/package.json ./packages/permissions/
COPY packages/validation/package.json ./packages/validation/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.json tsconfig.base.json ./

RUN pnpm --filter @construction/permissions run build || true
RUN pnpm --filter @construction/money run build || true
RUN pnpm --filter @construction/validation run build || true
RUN pnpm --filter @construction/web run build

# Nginx static server stage
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

# Clean default assets
RUN rm -rf ./*

# Copy built SPA assets
COPY --from=builder /app/apps/web/dist ./

# Nginx config is a template — API_UPSTREAM is injected at container start
# so the SPA's same-origin /api calls reach the API service.
RUN apk add --no-cache gettext
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
