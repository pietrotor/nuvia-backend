# AGENTS.md — nuvia-backend

API REST de Nuvi: NestJS 11 + PostgreSQL + Drizzle ORM, **modular monolith** con Clean Architecture Lite.
Package manager: **yarn**.

Antes de escribir código:

1. Producto: [../docs/prd-nuvi-v1.md](../docs/prd-nuvi-v1.md)
2. Arquitectura: [../docs/architecture.md](../docs/architecture.md)
3. WhatsApp/Evolution (anti-ban): [../docs/evolution-whatsapp-ops.md](../docs/evolution-whatsapp-ops.md)
4. Overview de este repo: [CLAUDE.md](CLAUDE.md)

## Comandos

```bash
yarn install
docker-compose up -d          # Postgres local (+ Redis / Evolution cuando estén en el compose)
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

## Forma del sistema

- **Modular monolith:** un feature = carpetas alineadas en `domain/`, `application/`, persistence e
  `interface/http/`. Nest modules exportan use cases públicos, no repos de otros features.
- **Agent** vive aquí (módulo `agent` + workers BullMQ). Tools del LLM llaman use cases existentes
  (`BookAppointmentUseCase`, etc.) — no duplican SQL.
- **WhatsApp:** Evolution API solo vía `MessagingPort` / `WhatsAppSessionPort` en
  `infrastructure/messaging/`.
- **Async:** webhooks ACK inmediato → cola; jobs con `tenantContext.runWithTenant`.
- **Tiempo real:** los use cases que mutan agenda llaman `AgendaEventPublisher.changed()` justo donde ya
  llaman `AuditRecorder` — el publish es best-effort y jamás hace fallar la mutación. Va por
  `EventBusPort` (Redis pub/sub, 16 canales fijos con ruteo por tenant en memoria) y sale al panel por
  `GET /events` como SSE. El evento avisa *que* algo cambió, nunca manda entidades. Diseño y números en
  [docs/plans/realtime-agenda-sse.md](../docs/plans/realtime-agenda-sse.md).
- **Listados:** puertos de lectura (`*ViewRepository`) devuelven la entidad más los resúmenes de clienta,
  profesional y servicio en un solo query. El panel y el agente nunca reciben ids sueltos, y el
  repositorio de escritura no acumula métodos de listado.
- Crecimiento: ver sección de escalabilidad en [docs/architecture.md](../docs/architecture.md)
  (swap a Meta Cloud, worker de agent separado, RLS) sin romper el dominio.

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
| [.agents/rules/whatsapp-evolution.md](.agents/rules/whatsapp-evolution.md) | messaging, agent outbound, webhooks, compose Evolution, scripts WA |

Vocabulario y puertos: [../.agents/rules/domain-vocabulary.md](../.agents/rules/domain-vocabulary.md).

## Estado del proyecto

Existe la base multi-tenant: `Tenant`, `User` (`owner | staff | superadmin`), `AuditLog`, contexto por
request, repositorios scoped. Y los cuatro puertos de infraestructura con sus adapters V1
(Evolution, LLM, storage local, clock).

| Épica | Estado |
|---|---|
| E1 config | `business-config` (incluida la moneda del negocio), `services`, `professionals`, `schedule-blocks` con CRUD; falta subir logo |
| E2 agente | Orquestador + registry; tools de catálogo, FAQ, disponibilidad, reservar, reagendar, cancelar, listar citas de la clienta y handoff. System prompt por capas según el rubro. Faltan tools de seña y saldo de paquete |
| E3 panel | Disponibilidad, agenda por rango de fechas (calendario), reservar, reagendar, cancelar, atendida, plantón, bandeja de conversaciones con pausar / reactivar / responder como persona (responder pausa al agente) |
| E4 señas, E5 paquetes, E6 recordatorios, E7 ficha, E8 reportes, E9 página pública | Sin empezar |
| E10 suscripción | Parcial: planes + suscripciones por tenant, cuotas de respuestas de IA (derivadas de `messages`), topes de capacidad al crear, corte suave del agente, `GET /subscriptions/me` y API de superadmin. Falta cobro manual con QR |

El **system prompt se compone por capas** y no se escribe suelto en ningún servicio: plataforma
(no negociable) → canal → rubro (`BusinessConfig.businessCategory`) → voz del negocio
(`agentPolicy.emojiPolicy` y `businessNotes`) → guarda de precedencia, más un bloque volátil aparte con
la fecha. El texto vive en `infrastructure/agent/prompts/` detrás de `PromptCatalogPort`, lo arma
`SystemPromptBuilder` (dominio puro) y lo cablea `AgentPromptComposer`. Cada respuesta del agente guarda
en `messages.prompt_fingerprint` qué prompt la produjo. Sumar un rubro = valor de enum + léxico +
fragmentos, sin tocar el composer. El rubro lo asigna **soporte**, no la dueña.

El handoff marca la conversación (`botPaused` + `handoffReason` + `botPausedAt`) y la bandeja la
destaca vía `attentionState`. Si la clienta escribe de nuevo tras
`agentPolicy.handoffAutoResumeMinutes` sin respuesta del staff, el bot se auto-reactiva (mensaje
puente + LLM). **Todavía no avisa a la dueña por WhatsApp**. `Message` no guarda media ni autoría
(bot vs persona): las dos cosas entran con la migración de E4.

### Deuda conocida

| Deuda | Riesgo |
|---|---|
| `test/multi-tenancy.e2e-spec.ts` no cubre citas ni conversaciones, y correrlo llama a `POST /seed`, que borra tenants y `business_configs` — se pierde la instancia de Evolution vinculada | El aislamiento de los endpoints nuevos no está verificado y el e2e no se puede correr sobre la base de desarrollo |
| `POST /conversations/:id/messages` responde 500 si el mensaje ya estaba registrado, después de haberlo enviado | La dueña ve error, reenvía y la clienta recibe el mensaje dos veces |
| `0006_configurable_currency.sql` está escrito a mano y no tiene snapshot: `drizzle-kit` necesita una terminal interactiva para resolver el rename de `price_bs` → `price` | El próximo `yarn db:generate` va a querer re-emitir el enum `currency` y los renames; hay que correrlo en una terminal real, responder "rename", y quedarse con el snapshot descartando el SQL duplicado |

`appointments_no_active_overlap` (constraint `EXCLUDE` con `tstzrange`) vive solo en
`drizzle/migrations/0002_harden_booking_constraints.sql`: Drizzle no sabe declarar `EXCLUDE` en el
schema. No lo borres al regenerar migraciones — es el cierre de la carrera por el mismo horario.

Agregar módulos siguiendo architecture.md y estas reglas — sin excepciones a las capas.
