---
description: Prácticas seguras Evolution/Baileys — anti-ban, tc-token/463, delay+presence, webhooks
activation: paths
paths:
  - "src/infrastructure/messaging/**/*.ts"
  - "src/application/messaging/**/*.ts"
  - "src/application/agent/**/*.ts"
  - "src/interface/http/webhooks/**/*.ts"
  - "src/infrastructure/queues/**/*.ts"
  - "docker/evolution/**"
  - "docker-compose.yaml"
  - "scripts/dev/whatsapp*"
---

# WhatsApp / Evolution — reglas para agentes

Guía completa (obligatoria si cambiás comportamiento de envío):

→ [docs/evolution-whatsapp-ops.md](../../../docs/evolution-whatsapp-ops.md)

Arquitectura: [docs/architecture.md](../../../docs/architecture.md) §9.

## Estado verificado (2026-08-03) — revalidá, cambia rápido

- Baileys `latest` = **`7.0.0-rc14`** (2026-07-29): es lo que usa la imagen de Nuvi.
- Evolution `v2.3.7` es intencional: **≥2.4.0 exige licencia** (`503 LICENSE_REQUIRED`) y
  igual pinnea Baileys `rc.9`. No subas la imagen sin decisión de producto.
- Antes de cambiar versiones, corré los comandos de revalidación del doc (§0).

## Obligatorias

1. **Solo reactivo.** Nada de campañas / broadcasts / outreach frío con Evolution.
2. **Webhook ACK inmediato** → BullMQ. Nunca LLM ni `sendText` pesado en el controller HTTP.
3. **Outbound humano:** las respuestas del agente van con `typingDelayMs`; el adapter lo
   traduce a `delay` y Evolution fuerza `composing`. Ver §4 R3 del doc. No mandes una
   respuesta del agente sin delay. Ojo: en Evolution ≤2.4.0-rc1 el path de typing tira 400
   con contactos `@lid` → mandar E.164 y degradar a envío sin delay (un retry, nunca loop).
4. **Heurística de delay:** `human-pacing.ts` (log-normal proporcional al texto, techo que
   satura, descontando lo que la clienta ya esperó, ×`circadianSlowdown` según hora local).
   No la dupliques ni la reemplaces por un `random` plano: la forma importa tanto como el
   jitter, y ningún envío puede caer siempre en el mismo valor de borde.
5. **Visto solo si contestás.** `markAsRead` va en el camino del agente; una conversación en
   handoff no se marca leída, porque la dueña todavía no la leyó.
6. **Debounce:** el inbound persiste apenas llega y el `reply` sale diferido; una ráfaga la
   contesta el job de la última. No vuelvas a contestar mensaje por mensaje.
7. **Circuit breaker 463:** ante `MessageUpdate=ERROR` / log 463 / timelock → **no** reintentar
   en loop; pausar outbound del tenant (o al menos contactos nuevos). WA Web no reintenta 463.
8. **Baileys ≥ rc14** con `tc-token-utils` en `docker/evolution/Dockerfile`. No volver a `rc.9`.
9. **Webhook en Docker:** `http://api:3010/...` (perfil `stack`). No asumir
   `host.docker.internal` desde WSL.
10. **Un consumer** de cola: no `yarn start:dev` + `nuvia_api` a la vez.
11. **Handoff / `botPaused`** se respetan.
12. **Probes** (`scripts/dev/whatsapp-*`): dev-only, una sonda, off durante restricción.
13. **LID:** persistir E.164 (`remoteJidAlt`); nunca guardar `@lid` como teléfono.
14. **Solo `MessagingPort`** habla con Evolution.

## Folklore vs evidencia

- Volúmenes (20–50 / 200–300 día) = **heurística de operadores**, no spec Meta.
- 463 + tc-token + reach-out timelock = **evidencia de protocolo** (Baileys #2441 y PRs).
- Evolution **no** trae rate-limit de outbound (#2538): Nuvi debe ponerlo.

## Alarmas → no “arreglar” a lo bruto

| Síntoma | Acción |
|---|---|
| 463 / ERROR en MessageUpdate | Parar probes; chequear Baileys; circuit breaker |
| `device_removed` | Un re-link QR |
| Webhook ECONNREFUSED | URL de red Docker, no spam send |
| Banner restricción en el tel | Esperar plazo; warm-up; no automatizar |

Warm-up ~10 días y migración Cloud API son producto/ops — no los saltees con más retries.
