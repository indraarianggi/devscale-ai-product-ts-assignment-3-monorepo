# Build context is the repo root (see docker-compose.yml) — pnpm needs to
# see the whole workspace manifest to resolve the lockfile correctly.

FROM node:22-alpine AS build
# `devEngines.packageManager` in package.json is a semver *range*
# ("pnpm@^11.20.0"), which `corepack enable` can't auto-provision from (it
# needs an exact pinned version) — install pnpm directly instead.
RUN npm install -g pnpm@11
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api

# `prisma generate` only needs DATABASE_URL to be set to satisfy schema
# validation — it doesn't connect to a database.
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/db" \
    pnpm --filter=api exec prisma generate
RUN pnpm --filter=api build

# ---------------------------------------------------------------------------
# apps/api has no "workspace:*" dependencies on other packages in the repo,
# so its own package.json is enough to install production deps standalone —
# the final image doesn't need pnpm or the rest of the monorepo.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY apps/api/package.json ./
RUN npm install --omit=dev

COPY --from=build /repo/apps/api/dist ./dist
# Schema + migrations aren't needed to run the app, but let `prisma migrate
# deploy` be run from this image (e.g. `docker compose run --rm api npx
# prisma migrate deploy`) without a separate host Node/pnpm install.
COPY apps/api/prisma ./prisma
COPY apps/api/prisma.config.ts ./

EXPOSE 8002
CMD ["node", "dist/index.js"]
