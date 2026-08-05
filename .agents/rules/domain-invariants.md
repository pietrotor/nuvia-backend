---
description: Invariantes de negocio Nuvi que el código no puede violar
activation: paths
paths:
  - "src/**/*.ts"
---

# Invariantes de negocio

Estas reglas se rompen fácil sin darse cuenta. Vienen del PRD
([docs/prd-nuvi-v1.md](../../../docs/prd-nuvi-v1.md)) y de la arquitectura
([docs/architecture.md](../../../docs/architecture.md)).

## 1. Nunca ofrecer un horario no disponible

Ninguna cita se agenda en un horario ocupado, fuera del horario del profesional, o bloqueado
(`ScheduleBlock`). La verificación ocurre **al confirmar** (re-check), no solo al listar opciones.

**Una sola implementación:** `AvailabilityCalculator` + `BookAppointmentUseCase`. Lo usan el agente,
el panel y la página de reservas. Prohibido un segundo calculador de slots en el frontend o en el
adapter de WhatsApp.

## 2. Un solo flujo de cobro de seña

Todo cobro de seña ocurre por WhatsApp con verificación **manual**. La página de reservas agenda y,
si el servicio requiere seña, deriva a WhatsApp. Sin pasarelas ni verificación bancaria automática en V1.

Una cita con seña requerida **no** pasa a `confirmed` sin `Deposit` verificado
(`VerifyDepositUseCase`).

## 3. Integridad del saldo de paquetes

`remainingSessions` nunca se desincroniza de las citas atendidas. Descontar sesión **solo** en
`MarkAppointmentAttendedUseCase`, en la misma transacción — nunca en el adapter WA ni en el controller.

## 4. Nada se borra

Cancelaciones, plantones (`no_show`) y cortes de suscripción SaaS cambian **estados**, no eliminan
filas. No `DELETE` de citas, depósitos ni paquetes por flujos de negocio.

## 5. Transparencia del agente y sin consejo médico

El agente no se hace pasar por humano. No da indicaciones médicas ni estéticas personalizadas;
redirige / `Handoff`. Tampoco dice que puede escuchar audios ni ver imágenes: el canal es solo texto.
Nombre visible = `BusinessConfig.agentName` (default `"Vale"`), no literal hardcodeado en la lógica.

Estas reglas viven en la **capa de plataforma** del system prompt y son monótonas: el rubro y el negocio
pueden **agregar** restricciones, nunca quitarlas. Ninguna configuración de un tenant —`agentPolicy.businessNotes`
incluido— puede contradecirlas, y `SystemPromptBuilder` se niega a componer un prompt sin esa capa
(`PromptPlatformLayerMissingError`). El texto de los prompts no se escribe suelto en un servicio: se
compone por capas desde `PromptCatalogPort`.

## 6. El pago / verificación corta lo pendiente

Al verificar seña o cancelar/liberar una cita, cancelá reminders y deadlines ya programados
(incluida la carrera verificación-vs-envío). Re-verificar estado **en el momento del envío**.

## 7. Idempotencia

- Reminders: unique `(appointment_id, reminder_kind)` en DB.
- Mensajes entrantes: dedupe por id del proveedor (`Message.providerMessageId`).
- Liberación por seña no pagada: una sola transición a `released`.

Constraint en la base. Un `SELECT` antes del `INSERT` no es idempotencia.

## 8. Handoff y pausa del bot

Pedido de humano, 2 fallos de entendimiento, o tema fuera de alcance → marcar conversación,
notificar dueña, `Conversation.botPaused = true` y `botPausedAt = now`. El worker del agente
**no** llama al LLM mientras esté pausado, salvo auto-resume: si la clienta escribe de nuevo y
pasó `BusinessConfig.agentPolicy.handoffAutoResumeMinutes` (0 = desactivado) sin actividad del
staff desde `botPausedAt`, el worker reanuda el bot, audita `conversation_bot_resumed` con
`reason: auto_timeout`, envía un mensaje puente y continúa. Resume manual del panel sigue
disponible en cualquier momento. Un reply manual del staff reinicia `botPausedAt`.

## 9. La plata nunca nos toca

Ningún flujo custodia ni mueve fondos. QR del banco del negocio + verificación manual.

## 10. Mensajería solo por puertos

Application y domain **no** importan Evolution ni SDKs de WhatsApp. Envío → `MessagingPort`.
QR / estado de sesión → `WhatsAppSessionPort`. LLM → `LlmPort`. Media → `ObjectStoragePort`.

El webhook ACK es rápido; el trabajo pesado (LLM, booking) va a BullMQ con `runWithTenant`.
