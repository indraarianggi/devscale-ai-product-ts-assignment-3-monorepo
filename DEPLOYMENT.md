# Deploying to a VPS

This guide deploys the Meal Plan Coach monorepo to a fresh Linux VPS
(Ubuntu 22.04/24.04 assumed) using:

- **Docker Compose** to build and run all five services — Postgres, Redis,
  the API, the background worker, and the frontend (see
  [docker-compose.yml](docker-compose.yml), [apps/api/Dockerfile](apps/api/Dockerfile),
  [apps/frontend/Dockerfile](apps/frontend/Dockerfile))
- **Nginx** on the host as a TLS-terminating reverse proxy in front of the
  frontend and API containers, with TLS via Let's Encrypt

No Node.js or pnpm install is needed on the VPS — everything builds and runs
inside containers, including database migrations.

> Run steps as a non-root sudo user. Replace `your-domain.com`,
> `api.your-domain.com`, and `you@example.com` with your own values.

---

## 1. Prepare the VPS

```bash
sudo apt update && sudo apt upgrade -y

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Nginx + certbot (for TLS in front of the containers)
sudo apt install -y nginx certbot python3-certbot-nginx
```

## 2. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
```

Only Nginx (80/443) and SSH should be exposed publicly. The frontend
(3002), API (8002), Postgres, and Redis containers stay bound to
localhost/Docker's internal network — Nginx is the only public entry point.

## 3. Clone the repo

```bash
sudo mkdir -p /var/www/meal-plan-coach
sudo chown $USER:$USER /var/www/meal-plan-coach
git clone <your-repo-url> /var/www/meal-plan-coach
cd /var/www/meal-plan-coach
```

## 4. Configure environment variables

```bash
cp .env.example .env
nano .env
```

Set production values:

```bash
NODE_ENV=production
PORT=8002

DATABASE_URL="postgres://mealplan:<strong-password>@localhost:65434/mealplan"

REDIS_HOST=localhost
REDIS_PORT=6381
REDIS_DB=0

OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=<your-real-key>

REPORTS_DIR=reports

VITE_API_BASE_URL=https://api.your-domain.com
```

**Change the default `POSTGRES_PASSWORD`/`POSTGRES_USER` before exposing
this to the internet** — edit both `docker-compose.yml` and `DATABASE_URL`
to match, since the compose file currently ships with `mealplan`/`mealplan`
as a convenience default for local dev.

`DATABASE_URL`/`REDIS_HOST`/`REDIS_PORT` in `.env` are only used by
tooling run from the host (e.g. `prisma migrate deploy` further down) — the
`api`/`worker` containers themselves talk to Postgres/Redis over the
internal Docker network regardless of what's in `.env` (see the
`environment:` overrides in `docker-compose.yml`).

`VITE_API_BASE_URL` is baked into the frontend's static bundle at **build
time** — it must be the public HTTPS URL you're setting up in step 7
(`https://api.your-domain.com`), not an internal Docker service name,
since it's called directly from the visitor's browser.

## 5. Build and start everything

```bash
docker compose up -d --build
docker compose ps   # confirm all five containers are healthy/running
```

## 6. Run database migrations

```bash
docker compose run --rm api npx prisma migrate deploy
```

This runs inside the `api` image against the containerized Postgres — no
host Node/pnpm needed. Safe to re-run; does nothing if there are no pending
migrations.

Verify the API is up:

```bash
curl http://localhost:8002/health
docker compose logs -f api worker   # Ctrl+C to stop following
```

## 7. Configure Nginx (TLS reverse proxy)

**Frontend, `/etc/nginx/sites-available/meal-plan-frontend`:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**API, `/etc/nginx/sites-available/meal-plan-api`:**

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Required for the chat SSE stream to work through the proxy —
        # buffering would delay/break the streamed response.
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
```

Enable both and reload:

```bash
sudo ln -s /etc/nginx/sites-available/meal-plan-frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/meal-plan-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Point DNS and enable HTTPS

Create `A` records for `your-domain.com` and `api.your-domain.com` pointing
at the VPS's public IP, then:

```bash
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

Certbot edits both Nginx configs to add TLS and redirects, and sets up
auto-renewal.

## 9. Smoke test

```bash
curl https://api.your-domain.com/health
```

Then open `https://your-domain.com` in a browser, create a meal plan, and
confirm:

- The plan generates (check `docker compose logs -f worker`)
- The PDF report link works (served from the `reports` named volume via the
  API's static file route)
- The chat panel streams a reply without a 404/timeout

---

## Redeploying after changes

```bash
cd /var/www/meal-plan-coach
git pull
docker compose up -d --build
docker compose run --rm api npx prisma migrate deploy   # apply any new migrations
```

If you changed `VITE_API_BASE_URL` in `.env`, rebuild the frontend
explicitly: `docker compose up -d --build frontend` (it won't pick up a
`.env` change unless rebuilt — the value is baked into the JS bundle, not
read at container start).

## Notes and follow-ups

- **Backups**: schedule regular `pg_dump` backups of the `mealplan`
  database (`docker compose exec postgres pg_dump -U mealplan mealplan >
  backup.sql`) and back up the `reports` named volume (generated PDFs
  aren't stored in Postgres) — `docker run --rm -v
  meal-plan-coach_reports:/reports -v $(pwd):/backup alpine tar czf
  /backup/reports.tar.gz -C / reports`.
- **Secrets**: `.env` contains `OPENROUTER_API_KEY` and DB credentials —
  ensure it's not world-readable (`chmod 600 .env`) and never committed.
- **Logs**: `docker compose logs -f [service]`. Consider setting a
  `logging:` driver with size limits in `docker-compose.yml` (e.g.
  `json-file` with `max-size`/`max-file`) so container logs don't grow
  unbounded on disk.
- **Scaling the worker**: if generation jobs back up, scale the worker
  service — `docker compose up -d --scale worker=3` — BullMQ workers are
  safe to run concurrently against the same queue.
