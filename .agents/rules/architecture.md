---
description: Capas, ubicación de archivos y convenciones de nombres del backend
activation: paths
paths:
  - "src/**/*.ts"
---

# Arquitectura por capas

Sistema completo (módulos, Evolution, agente, escalabilidad): [docs/architecture.md](../../../docs/architecture.md).
Este archivo fija **cómo organizar código** en el modular monolith.

Regla de dependencia: **Domain ← Application ← Interface**, con Infrastructure implementando los puertos de Domain. Las flechas nunca se invierten.

- `domain/` no importa **nada** de `@nestjs/*`, Drizzle, `pg`, ni de las otras capas. TypeScript puro.
- `application/` importa de `domain/` y de puertos. Puede usar `@Injectable`/`@Inject` de Nest (es el precio de usar su DI) pero **no** excepciones HTTP ni nada de `express`.
- `infrastructure/` implementa puertos de `domain/`. Es la única capa que conoce Drizzle, bcrypt, JWT, storage, Evolution, LLM SDKs, BullMQ.
- `interface/http/` solo traduce HTTP ↔ use cases (y webhooks → enqueue).
- Features verticales: mismo nombre de carpeta en `domain/`, `application/` e `interface/http/`. Un Nest module exporta use cases públicos, no repos ajenos.

## Dónde va cada archivo

| Qué | Dónde |
|---|---|
| Entidad | `src/domain/{feature}/entities/{name}.entity.ts` |
| Value object / enum de dominio | `src/domain/{feature}/value-objects/{name}.vo.ts` |
| Puerto de repositorio + token | `src/domain/{feature}/repositories/{name}.repository.ts` |
| Puerto de lectura + tipo de vista | `src/domain/{feature}/repositories/{name}-view.repository.ts` |
| Resumen de una feature para vistas de otra | `src/domain/{feature}/views/{name}-summary.ts` |
| Otros puertos (MessagingPort, LlmPort, ObjectStoragePort, WhatsAppSessionPort) | `src/domain/{feature}/ports/{name}.port.ts` |
| Excepción de dominio | `src/domain/{feature}/exceptions/{name}.exceptions.ts` |
| Use case | `src/application/{feature}/use-cases/{action}.use-case.ts` |
| DTO de entrada | `src/application/{feature}/dto/{name}.dto.ts` |
| Implementación de repositorio | `src/infrastructure/persistence/repositories/{name}.repository.impl.ts` |
| Schema de Drizzle | `src/infrastructure/persistence/drizzle/schema/{name}.schema.ts` |
| Mapper | `src/infrastructure/persistence/drizzle/mappers/{name}.mapper.ts` |
| Adaptador externo | `src/infrastructure/{concern}/{name}.adapter.ts` |
| Controller / módulo | `src/interface/http/{feature}/{feature}.controller.ts` · `.module.ts` |
| DTO de respuesta | `src/interface/http/{feature}/dto/{name}-response.dto.ts` |
| Guard / decorator / filter | `src/interface/http/common/{guards,decorators,filters}/` |

Carpetas de feature en **plural y en inglés**: `src/domain/appointments/`, `src/application/deposits/`,
`src/interface/http/services/`. Los nombres de los conceptos salen del glosario de
[domain-vocabulary.md](../../../.agents/rules/domain-vocabulary.md), no se traducen a criterio de cada uno.

La **conexión WhatsApp** vive en adapters (`EvolutionMessagingAdapter`, `EvolutionSessionAdapter`) bajo
`infrastructure/messaging/`. Domain/application solo ven `MessagingPort` / `WhatsAppSessionPort`.
El agente no depende del mecanismo de vinculación (QR hoy; Meta Cloud mañana).

## Imports

Usá los path aliases entre capas y relativos solo dentro de la misma carpeta de feature:

```ts
// BIEN
import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';

// MAL: relativo cruzando capas
import { Appointment } from '../../../domain/appointments/entities/appointment.entity';
```

Aliases disponibles: `@domain/*`, `@application/*`, `@infrastructure/*`, `@interface/*`.

El lint hace cumplir los límites: `src/domain/**` no puede importar `@nestjs/*`, Drizzle, `pg`, `express`
ni las capas de arriba, y `src/application/**` no puede importar Drizzle ni excepciones HTTP de Nest.

## Lecturas que van a una pantalla

Un listado que muestra una cita no puede devolver `serviceId`: el panel necesita el nombre del servicio,
de la profesional y de la clienta, y el agente necesita esos nombres para hablar. Esas lecturas salen de
un **puerto de lectura aparte** (`AppointmentViewRepository`, `ConversationViewRepository`) que devuelve
la entidad más los resúmenes de alrededor, resueltos **en el mismo query**:

```ts
export interface AppointmentView {
  appointment: Appointment; // la entidad entera: sus reglas no se duplican en la vista
  client: ClientSummary;
  professional: ProfessionalSummary;
  service: ServiceSummary;
}
```

- **Prohibido hidratar en un loop.** Un `for` con un `findById` adentro es un N+1: una consulta por fila.
  Si un join no alcanza, agrupá ids y traelos en un `inArray`, nunca de a uno.
- **Un query por listado.** Los joins van con `this.scope(tabla, ...)` (ver
  [multi-tenancy.md](multi-tenancy.md)) y con columnas explícitas: un `jsonb` como `weekly_hours` no tiene
  por qué viajar repetido en cada fila.
- El repositorio de escritura **no** crece con métodos de listado. Se queda con lo que alimenta reglas de
  negocio (`findOverlapping`, `findByProfessionalInRange`) y devuelve entidades.
- El DTO de respuesta aplana la vista y reusa los DTOs compartidos de
  `src/interface/http/common/dto/` para que la misma clienta o servicio tenga siempre la misma forma.

Cuando un listado necesite filtrar u ordenar por un campo de otra tabla (buscar por nombre de clienta,
por ejemplo), ese filtro va en el puerto de lectura y se resuelve en SQL, no en memoria.

## Entidades

Interface `{Name}Props` + clase con props `readonly` + métodos de negocio. Sin setters: los cambios de
estado devuelven una instancia nueva.

```ts
export interface AppointmentProps {
  id: string;
  tenantId: string;
  status: AppointmentStatus;
  startsAt: Date;
  endsAt: Date;
}

export class Appointment {
  public readonly id: string;
  public readonly status: AppointmentStatus;

  constructor(props: AppointmentProps) { /* asignaciones */ }

  confirmAfterDeposit(): Appointment {
    return new Appointment({ ...this, status: 'confirmed' });
  }
}
```

La lógica de negocio vive en la entidad, no en el use case. Si un use case tiene `if`s sobre el estado de
una entidad, ese `if` probablemente es un método de la entidad.
