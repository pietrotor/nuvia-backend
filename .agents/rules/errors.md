---
description: Excepciones de dominio con código de error, catálogo de mensajes y mapeo a HTTP
activation: paths
paths:
  - "src/**/*.ts"
---

# Errores

Tres reglas que no se negocian:

1. **Las excepciones HTTP existen solo en `interface/`.** Domain y application lanzan excepciones de
   dominio y un `ExceptionFilter` global las traduce a status codes.
2. **La excepción lleva un código, no un mensaje.** El texto vive en el catálogo de i18n.
3. **Se loguea una sola vez**, en el filter.

```ts
// BIEN — domain/appointments/exceptions/appointment.exceptions.ts
export class AppointmentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(ErrorCode.APPOINTMENT_NOT_FOUND, { id });
  }
}

// BIEN — en el use case
const appointment = await this.appointmentRepository.findById(id);
if (!appointment) throw new AppointmentNotFoundError(id);

// MAL — acopla la capa de aplicación a HTTP y hardcodea copy
if (!appointment) throw new NotFoundException(`No encontramos la cita ${id}`);
```

El lint bloquea el import de `NotFoundException` y compañía dentro de `src/application/**`.

## Jerarquía

`DomainException` es la base y guarda `code: ErrorCode` + `params` para interpolar. Las subclases
semánticas son las que el filter mapea a status:

| Base | Status | Cuándo |
|---|---|---|
| `NotFoundError` | 404 | No existe, o no existe **dentro de este tenant** |
| `ValidationError` | 400 | Invariante de negocio violada |
| `ConflictError` | 409 | Duplicado, estado incompatible (horario ocupado) |
| `ForbiddenError` | 403 | El rol no alcanza |
| `UnauthorizedError` | 401 | Credenciales o token inválidos |
| `InternalError` | 500 | Bug nuestro; no se le explica al cliente |

Toda excepción nueva extiende una de estas, nunca `Error` pelado.

## Códigos y mensajes

El código se agrega a `ErrorCode` (`src/domain/common/exceptions/error-code.ts`) y el texto a **cada**
locale de `src/infrastructure/i18n/locales/`. El diccionario es `Record<ErrorCode, string>`, así que si
olvidás el mensaje no compila.

```ts
// error-code.ts
APPOINTMENT_NOT_FOUND = 'APPOINTMENT_NOT_FOUND',
SLOT_UNAVAILABLE = 'SLOT_UNAVAILABLE',

// locales/es.ts
[ErrorCode.APPOINTMENT_NOT_FOUND]: 'No encontramos esa cita.',
[ErrorCode.SLOT_UNAVAILABLE]: 'Ese horario ya no está disponible.',
[ErrorCode.TENANT_SUSPENDED]: 'La cuenta de {name} está suspendida.',
```

Los `{placeholders}` se resuelven con los `params` de la excepción.

## Forma de la respuesta

Siempre la misma, la arma el filter:

```json
{
  "statusCode": 404,
  "code": "APPOINTMENT_NOT_FOUND",
  "message": "No encontramos esa cita.",
  "path": "/api/v1/appointments/123",
  "timestamp": "2026-07-29T18:33:56.337Z"
}
```

Los errores de validación del `ValidationPipe` agregan `details: string[]` con los mensajes por campo.
El frontend decide en base a `code`, nunca parseando `message`.

## Errores de base de datos

Son detalle de infraestructura: se traducen **en el repositorio**, no en el use case.

```ts
// BIEN
try {
  return await this.insertInto(appointments, row);
} catch (error) {
  throw DatabaseErrorTranslator.toDomain(error); // 23505 -> ConflictError, etc.
}
```

Un use case no debería tener `try/catch` salvo que haga algo con el error (compensar, reintentar,
degradar). Envolver para re-lanzar lo mismo solo esconde el stack.

## Datos personales

Nunca metas en un mensaje de error datos de una clienta (nombre, teléfono): el PRD pide cuidado con
datos personales. Los `params` que interpolás en un mensaje van a salir en la respuesta HTTP y en los logs.
