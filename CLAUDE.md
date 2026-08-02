# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

The conventions for this project live in [AGENTS.md](AGENTS.md) and in `.agents/rules/`, and they are the
source of truth for how code must be written here (layers, use cases, errors, persistence,
multi-tenancy, domain invariants, HTTP, testing). This file only describes **what currently exists**.

Product spec: [../docs/prd-nuvi-v1.md](../docs/prd-nuvi-v1.md).

## Project overview

Nuvi's REST API: NestJS 11 + PostgreSQL + Drizzle ORM, Clean Architecture Lite, strict multi-tenancy.

Global prefix `/api/v1`, Swagger at `/api/v1/swagger`. All code, identifiers and DB columns are in English;
user-facing text is Spanish and centralized (see below).

## Commands

```bash
yarn install
cp .env.template .env
docker-compose up -d          # Postgres

yarn start:dev
yarn lint                     # eslint --fix
yarn typecheck                # tsc --noEmit over src + test
yarn test                     # unit, no database
yarn test:e2e                 # multi-tenancy e2e, runs the seed (wipes local data)

yarn db:generate              # migration from the Drizzle schema
yarn db:migrate
yarn db:studio
```

`POST /api/v1/seed` recreates two test tenants with an owner and a staff each, plus a superadmin. Password
for all of them: `Secreta123`. It refuses to run when `NODE_ENV=production`.

## Layers

`domain/` ← `application/` ← `interface/http/`, with `infrastructure/` implementing the domain ports.
ESLint enforces the boundaries: `domain/` cannot import Nest, Drizzle, `pg`, `express` or the upper layers,
and `application/` cannot import Drizzle or Nest's HTTP exceptions.

```
src/
├── domain/            # entities, value objects, repository ports, domain exceptions
├── application/       # use cases + input DTOs, one class per business operation
├── infrastructure/    # Drizzle, auth, tenancy context, i18n, logger, error translation
└── interface/http/    # controllers, response DTOs, guards, decorators, exception filter
```

## Multi-tenancy

This is the part that is easiest to break, so it is worth knowing in detail:

- Every tenant table has `tenant_id` + an index. `users.tenant_id` and `audit_logs.tenant_id` are nullable
  only because a superadmin belongs to no tenant.
- The JWT payload is `{ sub, tenantId, role }`. `JwtStrategy` revalidates it against the database on every
  request (role, tenant, active user, tenant not suspended) and is the **only** place that fills the tenant
  context.
- `TenantContextService` holds `{ tenantId, userId, role }` in an `AsyncLocalStorage`. The store is opened
  empty by `TenantContextMiddleware` (middleware, not an interceptor, so guards and handler share the same
  async scope) and filled in during authentication.
- Repositories over tenant tables extend `TenantScopedRepository` and use `selectFrom` / `insertInto` /
  `updateIn` / `deleteFrom`, which resolve the tenant before building the query and throw
  `TenantContextMissingError` when there is none. `scope(table, ...)` is the escape hatch for joins.
- Methods that cannot be scoped (login, token validation, superadmin creation) are named `...Unscoped`.
- Background work opens its own scope: `tenantContext.runWithTenant(tenantId, fn)`.

Roles: `owner` and `staff` inside a tenant, `superadmin` for our support. `superadmin` does **not** inherit
tenant permissions; an endpoint that support should reach lists it explicitly in `@Auth(...)`.

## Errors

Domain and application layers throw `DomainException` subclasses carrying an `ErrorCode` and params, never
a message and never an HTTP exception. `DomainExceptionFilter` maps them to status codes and resolves the
Spanish text from `infrastructure/i18n/locales/`. Every response has the same shape:

```json
{ "statusCode": 404, "code": "USER_NOT_FOUND", "message": "No encontramos ese usuario.", "path": "...", "timestamp": "..." }
```

Postgres errors are translated inside the repository with `DatabaseErrorTranslator.toDomain(error)`.

## Current domain

Implemented: `Tenant` (status, timezone, config), `User` (one tenant per user, one role), `AuditLog`.

Not implemented yet — the Nuvi core from the PRD: professionals, services, appointments, deposits,
packages, clients, conversations, agent, reminders, booking page, subscription. Use the glossary in
[../.agents/rules/domain-vocabulary.md](../.agents/rules/domain-vocabulary.md) for their names. The
WhatsApp connection layer must stay decoupled from agent and business logic.

## Environment variables

`NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `HOST_API`,
`JWT_SECRET`, `JWT_EXPIRES_IN` (default `12h`), `CORS_ORIGINS`.

## Known traps

- `nest start --watch` leaves its `tsc` watcher alive when the app crashes on boot. Two watchers then race
  to write `dist/`, and you end up debugging output that no longer matches the source. When a boot error
  looks impossible, `pkill -f 'n[e]st start'`, `rm -rf dist *.tsbuildinfo` and start once.
- The Console Ninja extension patches `node_modules/@nestjs/core/index.js` and swallows the app's stdout,
  including bootstrap errors: the process dies with no output. If the server "starts" and logs nothing,
  disable the extension for this project or run `yarn build && node dist/main.js` to see the real error.
- Import CommonJS packages that use `export =` (e.g. `winston-daily-rotate-file`) with
  `import X = require('x')`, not `import X from 'x'`. The default import compiles to `.default` plus an
  interop helper that on-the-fly transpilers don't always emit, so it works under `nest build` and crashes
  under the watcher.
- Never add doc comments (JSDoc) to types, interfaces, enums or DTOs. See the vocabulary rule.
