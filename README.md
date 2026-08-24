# Nuvi API

REST API for Nuvi: multi-tenant agenda, WhatsApp agent, deposits, and owner panel backend.

Stack: **NestJS 11**, **PostgreSQL**, **Drizzle**, **Redis / BullMQ**, **Evolution API** (WhatsApp). Package manager: **yarn**. Global prefix `/api/v1`. Swagger at `/api/v1/swagger` (disabled when `NODE_ENV=production`).

This repo is the API only. The panel is `nuvia-frontend` (Vercel). Product and architecture live in the sibling docs of the workspace (`docs/prd-nuvi-v1.md`, `docs/architecture.md`).

## Local development

```bash
cp .env.template .env
yarn install
docker compose up -d          # Postgres (5435), Redis, Evolution (8080)
yarn db:migrate
yarn start:dev                # http://localhost:3010
```

`POST /api/v1/seed` recreates test tenants (owner + staff, password `Secreta123`). It **refuses to run in production**.

To run the API inside Docker (so Evolution can deliver webhooks without `host.docker.internal`):

```bash
docker compose --profile stack up -d --build
```

### Scripts

| Command | What it does |
|---|---|
| `yarn start:dev` | Nest with hot reload |
| `yarn build` / `yarn start:prod` | Compile and run `dist/main` |
| `yarn lint` / `yarn lint:check` / `yarn typecheck` | ESLint (fix / CI) + `tsc --noEmit` |
| `yarn test` / `yarn test:e2e` | Unit tests; e2e **wipes local data** via seed |
| `yarn db:generate` | New Drizzle migration from schema |
| `yarn db:migrate` | Apply migrations |
| `yarn db:studio` | Drizzle Studio |
| `yarn bootstrap:owner` | Create the first tenant + owner (fails if any tenant exists) |

## Production

Pilot topology:

| Surface | Where |
|---|---|
| Panel | Vercel — `https://nuvi.lat` |
| API + Postgres + Redis + Evolution + Caddy | DigitalOcean droplet — `https://api.nuvi.lat` |

WhatsApp webhooks must hit the droplet. Evolution is **not** published on the public internet; Caddy only reverse-proxies the API.

Full droplet bootstrap, DNS, first owner, Vercel env, and backups: **[docs/deploy-digitalocean.md](docs/deploy-digitalocean.md)**.

### Ship a backend change

Push to `main` (or run **Actions → CI → Run workflow**). After lint/tests pass, GitHub Actions builds the API image, copies it to the droplet, checks out that SHA, and recreates Compose services. Setup: [docs/deploy-digitalocean.md](docs/deploy-digitalocean.md#github-actions).

Manual fallback on the server (image built on the droplet, heavier on RAM):

```bash
cd /opt/nuvia-backend
git pull
docker compose -f docker-compose.prod.yaml up -d --build --no-deps api
```

`--no-deps` rebuilds and recreates **only** the API image. The container entrypoint runs Drizzle migrations, then starts Nest.

Rebuild more than the API when you changed:

| You changed | Recreate |
|---|---|
| `docker/evolution/**` | `evolution-api` (and then `api` if needed) |
| `docker/caddy/Caddyfile` | `caddy` (`up -d --force-recreate caddy`) |
| `docker-compose.prod.yaml` or DB/Redis env | full `up -d --build` |

Do **not** copy a new `.env` from git. `.env` is gitignored and stays on the droplet. After pulling, only edit `.env` if you added a **new** variable (see `.env.production.template`).

Checks:

```bash
curl -fsS https://api.nuvi.lat/api/v1/health
docker compose -f docker-compose.prod.yaml logs -f --tail=80 api
```

### Environment

| File | Use |
|---|---|
| `.env.template` | Local development |
| `.env.production.template` | Copy to `.env` **once** on the droplet |

Secrets (`JWT_SECRET`, `DB_PASSWORD`, `REDIS_PASSWORD`, `EVOLUTION_API_KEY`, `WEBHOOK_SECRET`) must be hex from `openssl rand -hex 32`. Redis and Evolution connection URIs break on `@`, `:`, or `/` in the password.

`CORS_ORIGINS` must list the panel origins (`https://nuvi.lat`, `https://www.nuvi.lat`). Compose **overrides** `DB_HOST`, `REDIS_*`, `EVOLUTION_API_URL`, `WEBHOOK_PUBLIC_URL`, and local storage path so containers talk on the internal network.

Storage in V1 is the `api_storage` volume (`STORAGE_DRIVER=local`), not S3.

## Auth roles

`owner` and `staff` (in-tenant), `superadmin` (no tenant). JWT payload is `{ sub, tenantId, role }`.
