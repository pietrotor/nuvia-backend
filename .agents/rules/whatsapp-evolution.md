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
3. **Outbound humano:** al enviar por Evolution incluir `delay` (ms) + `presence: "composing"`
   (o `recording` para audio). Ver §4 R3 del doc. Hoy el adapter manda `{number,text}` pelado
   — no dejes regresiones; al tocar el adapter, **agregá** delay/presence. Ojo: en Evolution
   ≤2.4.0-rc1 el path de typing tira 400 con contactos `@lid` → mandar E.164 y degradar a
   envío sin presence (nunca retry loop).
4. **Heurística de delay:** jitter ~3–8s + ~50–90ms/palabra, clamp 2.5–20s (o job equivalente).
5. **Circuit breaker 463:** ante `MessageUpdate=ERROR` / log 463 / timelock → **no** reintentar
   en loop; pausar outbound del tenant (o al menos contactos nuevos). WA Web no reintenta 463.
6. **Baileys ≥ rc14** con `tc-token-utils` en `docker/evolution/Dockerfile`. No volver a `rc.9`.
7. **Webhook en Docker:** `http://api:3010/...` (perfil `stack`). No asumir
   `host.docker.internal` desde WSL.
8. **Un consumer** de cola: no `yarn start:dev` + `nuvia_api` a la vez.
9. **Handoff / `botPaused`** se respetan.
10. **Probes** (`scripts/dev/whatsapp-*`): dev-only, una sonda, off durante restricción.
11. **LID:** persistir E.164 (`remoteJidAlt`); nunca guardar `@lid` como teléfono.
12. **Solo `MessagingPort`** habla con Evolution.

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
