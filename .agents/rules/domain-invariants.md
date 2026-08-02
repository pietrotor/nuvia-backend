---
description: Invariantes de negocio Nuvi que el código no puede violar
activation: paths
paths:
  - "src/**/*.ts"
---

# Invariantes de negocio

Estas reglas se rompen fácil sin darse cuenta. Vienen de [docs/prd-nuvi-v1.md](../../../docs/prd-nuvi-v1.md)
(sección 0 — reglas no negociables — y épicas E2–E6, E9–E10).

## 1. Nunca ofrecer un horario no disponible

Ninguna cita se agenda en un horario ocupado, fuera del horario del profesional, o bloqueado
(`ScheduleBlock`). La verificación de disponibilidad ocurre **al confirmar**, no solo al listar
opciones: entre la oferta y la confirmación el slot puede haberse tomado (WhatsApp, panel o web).

Si estás listando slots, filtrá contra la misma agenda que usa el panel y la página de reservas.
No hay agendas paralelas.

## 2. Un solo flujo de cobro de seña

Todo cobro de seña ocurre por WhatsApp con verificación **manual** de la dueña. Ningún otro canal
cobra por su cuenta: la página de reservas agenda y, si el servicio requiere seña, deriva a WhatsApp.
Sin pasarelas ni verificación bancaria automática en V1.

Una cita con seña requerida **no** pasa a confirmada sin verificación explícita (`Deposit` verificado).

## 3. Integridad del saldo de paquetes

El saldo de sesiones (`remainingSessions`) nunca debe desincronizarse de las citas atendidas.
Descontar sesión solo al marcar la cita como atendida, en un solo lugar del dominio — no en el
adaptador de WhatsApp ni en el controller.

## 4. Nada se borra

Cancelaciones, plantones (`NoShow`) y cortes por falta de pago de la suscripción SaaS cambian
**estados**, no eliminan filas. Soft-delete / status transitions; no `DELETE` de citas, depósitos ni
paquetes por flujos de negocio.

## 5. Transparencia del agente y sin consejo médico

El agente nunca se hace pasar por humano. Si preguntan, confirma que es asistente virtual.
No da indicaciones médicas ni estéticas personalizadas; redirige a la profesional y/o escala
(`Handoff`). El nombre visible del agente es configuración (`agentName`, default `"Vale"`), no un
literal hardcodeado en la lógica.

## 6. El pago / verificación corta lo pendiente

Cuando una seña se verifica o una cita se cancela/libera, cancelá recordatorios y deadlines de seña
ya programados para esa cita (incluida la carrera verificación-vs-envío). Re-verificar el estado
**en el momento del envío**, no confiar en el estado al programar.

## 7. Idempotencia

Los crons y webhooks corren más de una vez. Toda generación debe ser idempotente por clave de negocio:

- Recordatorios: único por `(appointment_id, reminder_kind)` (o equivalente) con constraint en DB.
- Webhooks / mensajes entrantes de WhatsApp: dedupe por id del mensaje del proveedor.
- Liberación por seña no pagada: un solo transition a liberada por cita.

La constraint va en la base. Un `SELECT` antes del `INSERT` no es idempotencia.

## 8. Handoff y pausa del bot

Cuando el cliente pide humano, el agente no entiende tras 2 intentos, o el tema está fuera de alcance
(reclamos, médico), marcar la conversación, notificar a la dueña y **dejar de responder** hasta que
ella reactive el bot. La dueña puede pausar/reactivar en cualquier conversación.

## 9. La plata nunca nos toca

Ningún flujo custodia, recibe ni redirige fondos. Generamos/enviamos el QR del banco del negocio y
registramos verificación manual. Si una tarea parece requerir mover dinero, está mal entendida.
