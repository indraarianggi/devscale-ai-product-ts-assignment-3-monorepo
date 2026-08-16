# Meal Plan Coach

An AI-powered meal planning assistant. You submit your body stats, goals, and dietary preferences; a background worker generates a personalized multi-day meal plan (with an AI self-review/revision loop) and renders it as a PDF report. A chat panel lets you ask follow-up questions about your plan, grounded in your plan data.

## Architecture

This is a pnpm monorepo with two apps that share a single Postgres database and Redis instance:

```
apps/
  api/        Hono API server + BullMQ background worker (Node/TypeScript)
  frontend/   React app (TanStack Router + Vite)
```

- **`apps/api`** — [Hono](https://hono.dev/) HTTP API using [Prisma](https://www.prisma.io/) (Postgres) for persistence and [BullMQ](https://docs.bullmq.io/) (Redis) for background jobs. It exposes two logical services:
  - **Meal plan module** (`src/modules/meal-plan`) — create/list/fetch meal plan requests, and redirect to the generated PDF report.
  - **Chat module** (`src/modules/chat`) — per-meal-plan chat history plus a streaming (SSE) endpoint for asking the AI questions about a plan.
  - **Worker** (`src/worker.ts`) — consumes `generate-meal-plan` jobs from the queue and runs the generation pipeline (`src/queue/pipeline`): generate all days → weekly AI review/revision → build the PDF report.
- **`apps/frontend`** — React 19 + [TanStack Router](https://tanstack.com/router) UI (file-based routes in `src/routes`) that talks to the API via a type-safe [Hono RPC client](https://hono.dev/docs/guides/rpc).

Both apps read configuration from a single `.env` file at the repo root.

## Prerequisites

- [Docker](https://www.docker.com/) — required either way (Postgres + Redis
  always run in containers; with Option A the API/worker/frontend do too,
  and no local Node install is needed at all)
- For Option B only: Node.js (LTS) and [pnpm](https://pnpm.io/) `^11.20.0`
  (see `devEngines` in `package.json`)
- An [OpenRouter](https://openrouter.ai/) API key (used for AI generation and chat)

## Getting started

Two ways to run this locally: everything in Docker (fastest to get going),
or a native Node dev setup (better for active development — hot reload,
debugger, etc).

### Option A: everything in Docker

```bash
cp .env.example .env
# edit .env and set OPENROUTER_API_KEY
docker compose up -d --build
docker compose run --rm api npx prisma migrate deploy   # apply Prisma migrations
```

This builds and runs Postgres, Redis, the API, the background worker, and
the frontend (served by Nginx) as five containers — see
[apps/api/Dockerfile](apps/api/Dockerfile), [apps/frontend/Dockerfile](apps/frontend/Dockerfile),
and [docker-compose.yml](docker-compose.yml). No local Node/pnpm install is
required for this option — migrations run inside the `api` image too.

- Frontend: http://localhost:3002
- API: http://localhost:8002

Migrations aren't applied automatically when containers start (so you're
never surprised by an auto-migration on deploy) — run the command above
once after the first `up`, and again after pulling changes that add new
migrations.

`VITE_API_BASE_URL` is baked into the frontend's static bundle at **build
time** (it's a Vite build arg, not a runtime env var) — if you change it in
`.env`, rebuild with `docker compose up -d --build frontend`.

To rebuild after pulling code changes:

```bash
docker compose up -d --build
```

### Option B: native Node dev setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `OPENROUTER_API_KEY` to your own key. The other defaults match the `docker-compose.yml` services below.

   | Variable                             | Description                                                                      |
   | ------------------------------------ | -------------------------------------------------------------------------------- |
   | `NODE_ENV`                           | `development` \| `test` \| `production`                                          |
   | `PORT`                               | API server port                                                                  |
   | `DATABASE_URL`                       | Postgres connection string                                                       |
   | `REDIS_HOST`/`REDIS_PORT`/`REDIS_DB` | Redis connection for the job queue                                               |
   | `OPENROUTER_API_KEY`                 | API key used for meal plan generation and chat                                   |
   | `OPENROUTER_BASE_URL`                | OpenRouter-compatible base URL                                                   |
   | `REPORTS_DIR`                        | Directory (relative to `apps/api`) where PDF reports are written and served from |
   | `VITE_API_BASE_URL`                  | API base URL the frontend calls                                                  |

3. **Start Postgres and Redis**

   ```bash
   docker compose up -d
   ```

4. **Run database migrations**

   ```bash
   pnpm --filter=api db:deploy
   ```

5. **Run the app**

   From the repo root, this starts the API and frontend dev servers in parallel:

   ```bash
   pnpm dev
   ```

   The background worker is separate and must be started too (in another terminal):

   ```bash
   pnpm worker:dev
   ```

   - API: http://localhost:8002 (Scalar API docs at `/reference` outside of production)
   - Frontend: http://localhost:3002

## Useful scripts

Run from the repo root unless noted.

| Command                             | Description                                        |
| ------------------------------------ | --------------------------------------------------- |
| `docker compose up -d --build`      | Build and run the full stack in Docker (Option A)  |
| `docker compose logs -f api worker` | Tail API/worker container logs                     |
| `pnpm dev`                     | Run API + frontend dev servers in parallel |
| `pnpm worker:dev`              | Run the meal-plan background worker        |
| `pnpm --filter=api db:migrate` | Create/apply a new Prisma migration (dev)  |
| `pnpm --filter=api db:deploy`  | Apply existing migrations (prod-safe)      |
| `pnpm --filter=api db:studio`  | Open Prisma Studio                         |
| `pnpm --filter=api test`       | Run API tests (Vitest)                     |
| `pnpm --filter=api build`      | Compile the API to `dist/`                 |
| `pnpm --filter=frontend build` | Build the frontend for production          |

## Project layout

```
apps/api/src/
  modules/meal-plan/   meal plan CRUD, service, repository, schema
  modules/chat/         chat history + streaming reply endpoint
  queue/                 BullMQ queue, worker, and generation pipeline
  routes/health.ts       DB/Redis health check endpoint
  lib/                   Prisma client, logger, nutrition calculations
  config/env.ts           environment variable validation (zod)
  index.ts                 HTTP server entrypoint
  worker.ts                 background worker entrypoint

apps/frontend/src/
  routes/                 TanStack Router file-based routes
  components/              UI components (e.g. chat panel)
  utils/                    Hono RPC client setup

apps/api/Dockerfile        API + worker image (see docker-compose.yml's `worker` service, which overrides the command)
apps/frontend/Dockerfile   Frontend image — Vite build served by Nginx
docker-compose.yml         postgres, redis, api, worker, frontend
```

For deployment to a VPS, see [DEPLOYMENT.md](./DEPLOYMENT.md).
