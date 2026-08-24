# Deploy Nuvi API on DigitalOcean (pilot)

Panel: Vercel at `https://nuvi.lat`. API: this Compose stack at `https://api.nuvi.lat`.

Droplet used for the first pilot: `143.198.122.33` (Ubuntu 24.04, 2 GB). WhatsApp webhooks must hit the droplet, never Vercel.

## DNS

- Apex / `www` of `nuvi.lat` → Vercel (their wizard).
- `A api.nuvi.lat` → droplet IPv4. Cloudflare proxy **off** (grey cloud) on `api`.

Let's Encrypt (Caddy) only works after `api.nuvi.lat` resolves here.

## Droplet once

```bash
# 2 GB swap (2 GB RAM is tight with Postgres + Redis + Evolution + Node)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf

# Docker
curl -fsSL https://get.docker.com | sh

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Clone **nuvia-backend** only (frontend is not served here):

```bash
git clone git@github.com:pietrotor/nuvia-backend.git /opt/nuvia-backend
cd /opt/nuvia-backend
cp .env.production.template .env
```

Fill `.env` before the first `up`:

```bash
# Hex only — these values are interpolated into Redis and Evolution URIs.
openssl rand -hex 32   # DB_PASSWORD
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # REDIS_PASSWORD
openssl rand -hex 32   # EVOLUTION_API_KEY
openssl rand -hex 32   # WEBHOOK_SECRET
```

Set `LLM_API_KEY` from OpenRouter. Leave `BOOTSTRAP_*` empty in `.env`; pass them only on the one-shot owner command below.

```bash
docker compose -f docker-compose.prod.yaml up -d --build
```

Create the first owner (fails if a tenant already exists). Do not persist the password in `.env`:

```bash
docker compose -f docker-compose.prod.yaml exec \
  -e BOOTSTRAP_TENANT_NAME='Estética piloto' \
  -e BOOTSTRAP_OWNER_NAME='Dueña' \
  -e BOOTSTRAP_EMAIL='duena@nuvi.lat' \
  -e BOOTSTRAP_PASSWORD='…' \
  -e BOOTSTRAP_COUNTRY_CODE=BO \
  -e BOOTSTRAP_TIMEZONE=America/La_Paz \
  api yarn bootstrap:owner
```

## GitHub Actions

PRs run lint, typecheck, unit tests, and `yarn build`. Push to `main` (or **Actions → CI → Run workflow**) also deploys.

The API image is built on GitHub (the 2 GB droplet should not compile Nest). Actions then `git checkout` that SHA on `/opt/nuvia-backend`, `docker load`s `nuvia/api:prod`, and runs `scripts/prod-release.sh`. Evolution/Caddy still build on the droplet when those files change. `.env` never leaves the server.

### One-time GitHub setup

1. Create a deploy key used **only** by Actions (do not reuse the droplet’s GitHub deploy key):

```bash
ssh-keygen -t ed25519 -f /tmp/nuvia-gha-deploy -N '' -C 'github-actions-nuvia'
```

2. On the droplet, append the **public** key:

```bash
cat /tmp/nuvia-gha-deploy.pub >> /root/.ssh/authorized_keys
```

3. In the **nuvia-backend** GitHub repo: **Settings → Environments → New environment → `production`**. Add environment secrets:

| Secret | Value |
|---|---|
| `DROPLET_HOST` | `143.198.122.33` or `api.nuvi.lat` |
| `DROPLET_USER` | `root` (or a user in the `docker` group) |
| `DROPLET_SSH_KEY` | Full private key (`-----BEGIN OPENSSH PRIVATE KEY-----` …) |

4. The droplet must still `git fetch` from GitHub (`git@github.com:pietrotor/nuvia-backend.git`). Keep the existing GitHub deploy key on the droplet.

Optional: in the `production` environment, enable required reviewers so a deploy waits for approval.

Until these secrets exist, the **Deploy to droplet** job fails; CI on PRs still runs.

## Ship backend changes

Preferred: merge to `main` and wait for the deploy job (health check hits `http://127.0.0.1/api/v1/health` on the droplet via Caddy).

Manual fallback (builds the image **on** the droplet):

The droplet is the source of runtime config (`.env` + Docker volumes). Git only brings code.

```bash
cd /opt/nuvia-backend
git status          # should be clean except .env (gitignored)
git pull
docker compose -f docker-compose.prod.yaml up -d --build --no-deps api
```

What happens:

1. Docker rebuilds `nuvia/api:prod` from `docker/api/Dockerfile`.
2. Compose recreates the `api` container (short blip; Postgres/Redis/Evolution stay up).
3. `/entrypoint.sh` runs Drizzle migrations against `nuvia`, then `node dist/main.js`.
4. Caddy keeps `https://api.nuvi.lat` pointed at the new container once health is `200` on `/api/v1/health` (`start_period` is 90s).

`--no-deps` is enough for application code, `drizzle/migrations`, and `src/`. Rebuild neighbours when those files change:

```bash
# Evolution image (Baileys patch, docker/evolution/**)
docker compose -f docker-compose.prod.yaml up -d --build evolution-api

# Caddyfile only (no image build)
docker compose -f docker-compose.prod.yaml up -d --force-recreate caddy

# Compose file, Postgres, Redis, or first-boot init SQL
docker compose -f docker-compose.prod.yaml up -d --build
```

If you added a variable to `.env.production.template`, copy the new key into the droplet `.env` **before** recreating `api`. Never replace the whole `.env` with the template (that wipes secrets).

### Rollback

Compose tags the API as `nuvia/api:prod` only (no git SHA). Rollback is `git checkout <previous-commit>` and the same `up -d --build --no-deps api`. Volumes (`postgres_data`, `redis_data`, `evolution_instances`, `api_storage`) are not reverted by that.

### Logs and health

```bash
curl -fsS https://api.nuvi.lat/api/v1/health
docker compose -f docker-compose.prod.yaml ps
docker compose -f docker-compose.prod.yaml logs -f --tail=80 api
```

Swagger is off in production. Use the panel at `https://nuvi.lat`.

## Vercel (panel)

Project root: `nuvia-frontend`. Env (Production, **build** — Vite inlines it):

`VITE_API_URL=https://api.nuvi.lat/api/v1`

`pnpm install` needs `design-system-eduno`. Pack it before the first deploy:

```bash
cd eduno-design-system && pnpm install && pnpm build && pnpm pack
```

Or publish the package to npm and point `package.json` at that version.

SPA fallback is in `vercel.json`. Custom domain: `nuvi.lat` + `www`.

`CORS_ORIGINS` on the API must include those origins or the browser will block login.

## Checks after first deploy or a release

- `curl -fsS https://api.nuvi.lat/api/v1/health`
- Login at `https://nuvi.lat/login`
- Connect WhatsApp from Settings (QR). Evolution is not exposed on the public internet; the API talks to it on the Docker network (`http://evolution-api:8080`). Webhooks use `WEBHOOK_PUBLIC_URL=http://api:3010/api/v1/webhooks/whatsapp` (overridden in Compose).

## Backups

DigitalOcean droplet snapshot weekly. Also dump the two databases (Evolution has its own `evolution` DB created by `docker/init-databases.sql`):

```bash
docker compose -f docker-compose.prod.yaml exec -T db \
  pg_dump -U postgres nuvia > nuvia-$(date +%F).sql
docker compose -f docker-compose.prod.yaml exec -T db \
  pg_dump -U postgres evolution > evolution-$(date +%F).sql
```

Receipts and logos in V1 live on the `api_storage` volume, not in Postgres.
