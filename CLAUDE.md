# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

Conventions live in [AGENTS.md](AGENTS.md) and `.agents/rules/` — source of truth for how code is
written (layers, use cases, errors, persistence, multi-tenancy, invariants, HTTP, testing).

| Doc | Role |
|---|---|
| [../docs/prd-nuvi-v1.md](../docs/prd-nuvi-v1.md) | Product |
| [../docs/architecture.md](../docs/architecture.md) | System design: modular monolith, ports, data model, Evolution, agent, growth |
| This file | What currently exists in this repo |

## Project overview

Nuvi backend: **modular monolith** — NestJS 11 + PostgreSQL + Drizzle ORM, Clean Architecture Lite,
strict multi-tenancy. Global prefix `/api/v1`, Swagger at `/api/v1/swagger`.

Code and DB columns in English; user-facing text Spanish and centralized (i18n / catalogs).

### Target shape (not all implemented yet)

```
src/
├── domain/            # entities, VOs, repo ports, MessagingPort, LlmPort, domain services
├── application/       # one use case class per business operation; agent orchestrator; job handlers
├── infrastructure/    # Drizzle, Evolution adapters, LLM adapter, BullMQ, storage, auth, tenancy, i18n
└── interface/http/    # controllers, webhooks, response DTOs, guards, filters
```

Features are vertical slices across those layers (`appointments`, `deposits`, `agent`, `messaging`, …).
`AgentModule` depends on **other features' use cases**, not their repositories. See architecture.md.

## Commands

```bash
yarn install
cp .env.template .env
docker-compose up -d          # Postgres (+ Redis / Evolution when compose is extended)

yarn start:dev
yarn lint
yarn typecheck
yarn test
yarn test:e2e                 # runs seed; wipes local data

yarn db:generate
yarn db:migrate
yarn db:studio
```

`POST /api/v1/seed` recreates two test tenants (owner + staff each) plus a superadmin. Password:
`Secreta123`. Refuses to run when `NODE_ENV=production`.

## Layers

`domain/` ← `application/` ← `interface/http/`, with `infrastructure/` implementing domain ports.
ESLint enforces boundaries: `domain/` cannot import Nest, Drizzle, `pg`, `express` or upper layers;
`application/` cannot import Drizzle or Nest HTTP exceptions.

Stable ports (tokens registered only in infrastructure modules):

- `MessagingPort` / `WhatsAppSessionPort` — Evolution today; Meta Cloud later
- `LlmPort` — OpenRouter by default (OpenAI-compatible protocol; Anthropic native optional)
- `ObjectStoragePort` — local now; S3/MinIO later

## Multi-tenancy

- Every tenant table has `tenant_id` + index. `users.tenant_id` and `audit_logs.tenant_id` nullable for
  superadmin / pre-auth audit.
- JWT `{ sub, tenantId, role }`; `JwtStrategy` revalidates and is the **only** place that fills tenant
  context (`AsyncLocalStorage` via `TenantContextService`).
- Repositories extend `TenantScopedRepository` (`selectFrom` / `insertInto` / `updateIn` / `deleteFrom`).
  Unscoped methods are named `...Unscoped`.
- Background work: `tenantContext.runWithTenant(tenantId, fn)` per tenant.

Roles: `owner`, `staff` (in-tenant), `superadmin`. Controllers declare `Permission`s via `@Auth`;
`permissionsForRole` maps role → permissions. Branch scope via `user_branches` (no rows = whole tenant).

## Errors

Domain/application throw `DomainException` + `ErrorCode` (never HTTP exceptions, never raw messages).
`DomainExceptionFilter` maps status + Spanish copy from `infrastructure/i18n/locales/`.

## Current domain

**Implemented:** tenants, business-config (brand identity), **branches** (location hours + catalog
offers + rotating staff), professionals/services, appointments + availability, schedule blocks,
deposit QRs, clients, conversations, WhatsApp agent tools (branch-aware), messaging/LLM/storage
adapters, BullMQ, SSE agenda events.

**Not implemented yet:** deposit receipt verification queue, packages, reminders, subscriptions,
public booking page, fine-grained panel roles (`manager` / `receptionist` / `professional`).

Shared booking path: `BranchResolver` → `ScheduleContextResolver` → `AvailabilityCalculator` →
`BookAppointmentUseCase` (WhatsApp, panel, and future public page).

## Environment variables

`NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `HOST_API`,
`JWT_SECRET`, `JWT_EXPIRES_IN` (default `12h`), `CORS_ORIGINS`.

LLM (OpenRouter by default): `LLM_PROVIDER` (`openrouter` | `openai-compatible` | `anthropic`),
`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (fixed OpenRouter slug with tool support),
`LLM_MAX_TOKENS`, optional `LLM_HTTP_REFERER` / `LLM_APP_TITLE`. See `.env.template`.

Redis / Evolution keys when those adapters are used.
## Known traps

- `nest start --watch` can leave a stale `tsc` watcher after a boot crash — `pkill -f 'n[e]st start'`,
  `rm -rf dist *.tsbuildinfo`, restart once.
- Console Ninja can swallow Nest bootstrap stdout — disable for this project if the server “starts”
  with no logs.
- CommonJS `export =` packages: `import X = require('x')`, not default import.
- No JSDoc on types/interfaces/enums/DTOs — see vocabulary rule.
