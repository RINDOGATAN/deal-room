# syntax=docker/dockerfile:1
# ============================================================================
# Dealroom — sovereign image (deploy/sovereign/docker-compose.yml).
# Multi-stage: deps → builder (prisma generate + standalone next build) →
# runner (minimal app) + migrator (minimal one-shot migrate/seed image —
# prisma CLI, generated client, tsx, migrations, seeds and skills only; NOT
# the app build, so `suite.sh update` re-downloads MBs, not GBs).
# The app code is UNCHANGED from cloud — only env differs.
# ============================================================================

# Base image pinned by multi-arch index digest (supply-chain: a tag can move,
# a digest cannot). To refresh after a deliberate bump:
#   docker buildx imagetools inspect node:22-alpine   → copy the Digest line.
ARG NODE_IMAGE=node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2

# ---- deps: full install (dev deps included — the builder needs them) -------
FROM ${NODE_IMAGE} AS deps
RUN apk add --no-cache libc6-compat openssl
# The lockfile is written by npm 11.6; node:22's bundled npm 10 resolves it
# differently ("Missing: … from lock file"). Pin the version that wrote it.
RUN npm install -g npm@11.6.2
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: prisma client + standalone Next build (also the migrator) ----
FROM ${NODE_IMAGE} AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the bundles at BUILD time — thread
# them through as build args (compose passes them from .env). Changing any
# of these later requires: docker compose up -d --build app
ARG NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true
ARG NEXT_PUBLIC_TESTER_MODE=false
# Off by default since 2026-08-05: self-host skills are already free via the
# Stripe-off posture (features.allSkillsFree), and baking the promo flag made
# the cloud "free right now" banner show on sovereign installs where nothing
# was ever for sale (and suppressed the marketplace footer link).
ARG NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS=""
ARG NEXT_PUBLIC_BRAND_NAME=""
ARG NEXT_PUBLIC_BRAND_ACCENT=""
ARG NEXT_PUBLIC_BRAND_LOGO_URL=""
# Storefront for premium-skill deep links (self-host has no in-app checkout).
ARG NEXT_PUBLIC_MARKETPLACE_URL="https://todo.law/legalskills"
# Google sign-in button (src/landing/auth) — empty = button hidden.
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
# Firmas mobile-signing deep links. The code falls back with `??` — an empty
# STRING would defeat it, hence the :- default below mirrors the in-code one.
ARG NEXT_PUBLIC_FIRMAS_BASE_URL=""
ENV NEXT_PUBLIC_LOCAL_AUTH_ENABLED=$NEXT_PUBLIC_LOCAL_AUTH_ENABLED \
    NEXT_PUBLIC_TESTER_MODE=$NEXT_PUBLIC_TESTER_MODE \
    NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS=$NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS \
    NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME \
    NEXT_PUBLIC_BRAND_ACCENT=$NEXT_PUBLIC_BRAND_ACCENT \
    NEXT_PUBLIC_BRAND_LOGO_URL=$NEXT_PUBLIC_BRAND_LOGO_URL \
    NEXT_PUBLIC_MARKETPLACE_URL=$NEXT_PUBLIC_MARKETPLACE_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_FIRMAS_BASE_URL=${NEXT_PUBLIC_FIRMAS_BASE_URL:-https://www.firmas.io} \
    NEXT_OUTPUT_STANDALONE=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
# prisma generate needs no live DB; give next build a placeholder so nothing
# dials out during static generation. (The repo's `npm run build` also runs
# `prisma migrate deploy` — that belongs to the migrator service, not here.)
# Separate RUN steps: a failed/changed app build never invalidates or gates
# the generated Prisma client layer.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    DATABASE_URL_UNPOOLED=postgresql://build:build@localhost:5432/build
RUN npx prisma generate
RUN npx next build

# ---- migrator: minimal one-shot migrate/seed image --------------------------
# Published as ghcr.io/rindogatan/deal-room-migrator. Contains ONLY what
# deploy/sovereign/migrate.sh needs: the prisma CLI + generated client (npx
# prisma db push / migrate resolve / migrate deploy), tsx (runs prisma/seed.ts
# and seed-marketplace.ts via `npm run db:seed*`), the prisma/ directory
# (schema + append-only migrations + seeds + hosted-skills + catalog), and
# skills/ (seed.ts scans ../skills relative to prisma/). Layers are ordered
# most-stable-first so a typical release re-downloads only the small
# migrations/seed layers, not the toolchain.
FROM ${NODE_IMAGE} AS migrator
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
# 1. Toolchain, pinned to the versions the lockfile resolves — installed
#    explicitly instead of copying the app's full node_modules (dev deps and
#    all). A scratch package.json keeps npm from installing the app's tree;
#    --ignore-scripts skips @prisma/client's postinstall generate (we generate
#    against the real schema in the next layer).
COPY package-lock.json /tmp/package-lock.json
RUN echo '{}' > package.json && \
    v() { node -p "require('/tmp/package-lock.json').packages['node_modules/$1'].version"; } && \
    npm install --no-save --ignore-scripts --no-audit --no-fund \
      "prisma@$(v prisma)" "@prisma/client@$(v @prisma/client)" "tsx@$(v tsx)" && \
    rm -rf package.json /tmp/package-lock.json /root/.npm /tmp/node-compile-cache
# 2. Generated client — changes only when the schema changes. Engine caches
#    are removed in the same RUN so they never fatten the layer.
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate && rm -rf /root/.cache /tmp/node-compile-cache
# 3. The churn layers: migrations, seeds, skills, the migrate script, and the
#    real package.json (migrate.sh calls `npm run db:seed*`). Kept last and
#    small. The kit compose runs this image with working_dir /app and
#    entrypoint `sh deploy/sovereign/migrate.sh` — paths must not move.
COPY package.json ./package.json
COPY prisma ./prisma
COPY skills ./skills
COPY deploy/sovereign/migrate.sh ./deploy/sovereign/migrate.sh

# ---- runner: minimal standalone runtime -------------------------------------
FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# The skills engine reads clause libraries from disk at runtime
# (process.cwd()/skills + data/skills); the standalone tracer doesn't
# pick these up. Marketplace-installed skills land in
# data/skills/installed — a named volume in the compose file.
COPY --from=builder --chown=node:node /app/skills ./skills
COPY --from=builder --chown=node:node /app/data ./data
RUN mkdir -p /app/data/skills/installed && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
