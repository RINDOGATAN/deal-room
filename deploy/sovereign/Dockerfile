# syntax=docker/dockerfile:1
# ============================================================================
# Dealroom — sovereign image (deploy/sovereign/docker-compose.yml).
# Multi-stage: deps → builder (prisma generate + standalone next build) →
# runner (minimal). The `builder` stage doubles as the one-shot migrator
# (it has the prisma CLI, tsx, the migrations and the seed).
# The app code is UNCHANGED from cloud — only env differs.
# ============================================================================

# ---- deps: full install (dev deps included — the builder needs them) -------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
# The lockfile is written by npm 11.6; node:22's bundled npm 10 resolves it
# differently ("Missing: … from lock file"). Pin the version that wrote it.
RUN npm install -g npm@11.6.2
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: prisma client + standalone Next build (also the migrator) ----
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the bundles at BUILD time — thread
# them through as build args (compose passes them from .env). Changing any
# of these later requires: docker compose up -d --build app
ARG NEXT_PUBLIC_LOCAL_AUTH_ENABLED=true
ARG NEXT_PUBLIC_TESTER_MODE=false
ARG NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS=true
ARG NEXT_PUBLIC_BRAND_NAME=""
ARG NEXT_PUBLIC_BRAND_ACCENT=""
ARG NEXT_PUBLIC_BRAND_LOGO_URL=""
ENV NEXT_PUBLIC_LOCAL_AUTH_ENABLED=$NEXT_PUBLIC_LOCAL_AUTH_ENABLED \
    NEXT_PUBLIC_TESTER_MODE=$NEXT_PUBLIC_TESTER_MODE \
    NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS=$NEXT_PUBLIC_FREE_TRIAL_ALL_SKILLS \
    NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME \
    NEXT_PUBLIC_BRAND_ACCENT=$NEXT_PUBLIC_BRAND_ACCENT \
    NEXT_PUBLIC_BRAND_LOGO_URL=$NEXT_PUBLIC_BRAND_LOGO_URL \
    NEXT_OUTPUT_STANDALONE=true \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
# prisma generate needs no live DB; give next build a placeholder so nothing
# dials out during static generation. (The repo's `npm run build` also runs
# `prisma migrate deploy` — that belongs to the migrator service, not here.)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    DATABASE_URL_UNPOOLED=postgresql://build:build@localhost:5432/build
RUN npx prisma generate && npx next build

# ---- runner: minimal standalone runtime -------------------------------------
FROM node:22-alpine AS runner
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
