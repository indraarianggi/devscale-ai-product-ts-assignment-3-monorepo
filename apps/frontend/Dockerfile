# Build context is the repo root (see docker-compose.yml) — pnpm needs to
# see the whole workspace manifest to resolve the lockfile correctly, and
# `src/utils/api.ts` has a type-only import reaching into apps/api/src.

FROM node:22-alpine AS build
RUN npm install -g pnpm@11
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api/src apps/api/src
COPY apps/frontend apps/frontend

# Baked into the static bundle at build time — must be the public URL the
# browser can reach (not a Docker-internal service name).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm --filter=frontend build

# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80
