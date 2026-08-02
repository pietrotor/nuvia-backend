# AGENTS.md — nuvia-backend

API REST de Nuvi: NestJS 11 + PostgreSQL + Drizzle ORM, Clean Architecture Lite. Package manager: **yarn**.

Antes de escribir código leé el spec del producto en [../docs/prd-nuvi-v1.md](../docs/prd-nuvi-v1.md) y el overview de este proyecto en [CLAUDE.md](CLAUDE.md).

## Comandos

```bash
yarn install
docker-compose up -d          # Postgres local
yarn start:dev                # dev con hot reload
yarn lint                     # eslint --fix, correr antes de terminar cualquier tarea
yarn typecheck                # tsc --noEmit (src + test)
yarn test                     # unit, sin base de datos
yarn test:e2e                 # e2e, corre el seed: borra los datos locales
yarn db:generate              # genera migración desde el schema de Drizzle
yarn db:migrate               # aplica migraciones
yarn db:studio
```

API con prefijo `/api/v1`. Swagger en `/api/v1/swagger`. `POST /api/v1/seed` recrea tenants de prueba
con owner y staff (`Secreta123`) y solo funciona fuera de producción.

## Reglas

| Regla | Aplica a |
|---|---|
| [.agents/rules/architecture.md](.agents/rules/architecture.md) | `src/**/*.ts` |
| [.agents/rules/use-cases.md](.agents/rules/use-cases.md) | `src/application/**/*.ts` |
| [.agents/rules/errors.md](.agents/rules/errors.md) | `src/**/*.ts` |
| [.agents/rules/persistence.md](.agents/rules/persistence.md) | `src/infrastructure/persistence/**/*.ts`, `drizzle/**` |
| [.agents/rules/multi-tenancy.md](.agents/rules/multi-tenancy.md) | `src/**/*.ts` |
| [.agents/rules/domain-invariants.md](.agents/rules/domain-invariants.md) | `src/**/*.ts` |
| [.agents/rules/http-api.md](.agents/rules/http-api.md) | `src/interface/**/*.ts` |
| [.agents/rules/testing.md](.agents/rules/testing.md) | `src/**/*.spec.ts`, `test/**/*.ts` |

Más el vocabulario de dominio transversal: [../.agents/rules/domain-vocabulary.md](../.agents/rules/domain-vocabulary.md).

## Estado del proyecto

Este backend heredó un starter multi-tenant. Hoy existe la base de tenancy (`Tenant`, `User` con rol
`owner | staff | superadmin`, `AuditLog`, contexto de tenant por request y repositorios scoped).

Del dominio Nuvi (agenda, servicios, profesionales, citas, señas, paquetes, conversaciones, agente)
**todavía falta el core.** Cuando lo agregues, seguí las reglas de `.agents/rules/` y el glosario del PRD.
La capa de conexión WhatsApp debe quedar desacoplada del agente y de la lógica de negocio.
