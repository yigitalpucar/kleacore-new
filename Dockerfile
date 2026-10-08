FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Self-contained Prisma CLI for `prisma migrate deploy` at container start.
# The standalone Next.js output only traces runtime files, and pnpm's symlinked
# store can't be copied piecemeal, so install the exact CLI version from the
# lockfile with npm into a flat node_modules (schema engine for musl included).
FROM deps AS migrator
RUN PRISMA_VERSION="$(node -p "require('prisma/package.json').version")" \
  && DOTENV_VERSION="$(node -p "require('dotenv/package.json').version")" \
  && mkdir -p /migrate && cd /migrate \
  && echo '{"name":"kleacore-migrate","private":true}' > package.json \
  && npm install --no-audit --no-fund --omit=dev --no-package-lock \
    "prisma@${PRISMA_VERSION}" "dotenv@${DOTENV_VERSION}" \
  && ./node_modules/.bin/prisma --version

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm prisma generate
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./package.json
# Migration toolkit lives in its own directory so it can't clash with the
# traced node_modules of the standalone server.
COPY --from=migrator /migrate/node_modules ./migrate/node_modules
COPY --from=builder /app/prisma ./migrate/prisma
COPY --from=builder /app/prisma.config.ts ./migrate/prisma.config.ts
COPY --from=builder /app/scripts/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder /app/scripts/cron-run.sh ./cron-run.sh
RUN chmod +x ./docker-entrypoint.sh ./cron-run.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# busybox wget ships with alpine (no curl/bash in this image).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null -T 4 "http://127.0.0.1:${PORT}/api/health" || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]