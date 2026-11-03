# Multi-stage Dockerfile for MjengoLedger Web PWA (@construction/web)
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
COPY tsconfig.json ./

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

# Configure Nginx for SPA routing and PWA caching
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    location /sw.js {\n\
        add_header Cache-Control "no-cache";\n\
        expires 0;\n\
    }\n\
\n\
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
