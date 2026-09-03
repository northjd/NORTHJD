# NORTH — container image.
#
# Host-agnostic on purpose. This runs on a container platform, a VM, Kubernetes, Fly,
# Railway, Render or Cloud Run without modification, and Vercel ignores it and builds
# natively. Nothing in the application is tied to a provider: configuration arrives as
# environment variables, state lives in PostgreSQL, and the process is stateless, so
# scaling out is a matter of running more of them.
#
# Requires an external PostgreSQL. PGlite is for local development only — it is
# single-threaded WASM and will not survive concurrent users.

# ── Dependencies ────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
# Copy only what npm needs to resolve the workspace graph, so this layer caches
# across source edits.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/domain/package.json ./packages/domain/
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/connectors/package.json ./packages/connectors/
COPY packages/intelligence/package.json ./packages/intelligence/
COPY packages/ai/package.json ./packages/ai/
COPY packages/search/package.json ./packages/search/
COPY packages/ranking/package.json ./packages/ranking/
COPY packages/learning/package.json ./packages/learning/
COPY packages/evaluation/package.json ./packages/evaluation/
COPY packages/ui/package.json ./packages/ui/
RUN npm ci

# ── Build ───────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Produces the self-contained server bundle this image copies below. Off by default,
# because `next start` cannot serve a standalone build.
ENV BUILD_STANDALONE=1
# A build-time placeholder: config is validated at boot, and nothing here connects.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
RUN npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Managed PostgreSQL handles real concurrency, unlike the local PGlite backend, so the
# client uses a pool rather than a single serialised connection.
ENV DATABASE_POOL_MAX=10

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs north

# The standalone output carries its own minimal node_modules.
COPY --from=builder --chown=north:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=north:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=north:nodejs /app/apps/web/public ./apps/web/public
# Migrations ship with the image so a release can apply its own schema.
COPY --from=builder --chown=north:nodejs /app/packages/database/migrations ./packages/database/migrations
COPY --from=builder --chown=north:nodejs /app/packages/database/sql ./packages/database/sql

USER north
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
