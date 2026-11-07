# HaitiViral: the site in one container (Next.js standalone server + database migrations at start).
# Built and run by docker-compose.yml; see docs/DOCKER.md.

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# 1. Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# 2. Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public values built into the pages (set in .env; rebuild after changing them)
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
RUN npx prisma generate && npm run build
# Prisma CLI with its own dependencies, for "migrate deploy" when the container starts
RUN mkdir /migrate && cd /migrate && echo '{"private":true}' > package.json \
  && npm install --no-audit --no-fund "prisma@$(node -p "require('/app/node_modules/prisma/package.json').version")"

# 3. Run: only what the server needs
FROM base AS run
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 UPLOAD_DIR=/data/uploads
RUN groupadd -g 1001 app && useradd -u 1001 -g app -m app && mkdir -p /data/uploads && chown -R app:app /data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /migrate/node_modules ./migrate/node_modules
COPY --chown=app:app docker/start.sh ./start.sh
COPY --chown=app:app docker/cron.mjs ./docker/cron.mjs
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "./start.sh"]
