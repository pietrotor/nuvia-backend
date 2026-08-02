---
description: Capas, ubicación de archivos y convenciones de nombres del backend
activation: paths
paths:
  - "src/**/*.ts"
---

# Arquitectura por capas

Regla de dependencia: **Domain ← Application ← Interface**, con Infrastructure implementando los puertos de Domain. Las flechas nunca se invierten.

- `domain/` no importa **nada** de `@nestjs/*`, Drizzle, `pg`, ni de las otras capas. TypeScript puro.
- `application/` importa de `domain/` y de puertos. Puede usar `@Injectable`/`@Inject` de Nest (es el precio de usar su DI) pero **no** excepciones HTTP ni nada de `express`.
- `infrastructure/` implementa puertos de `domain/`. Es la única capa que conoce Drizzle, bcrypt, JWT, S3, WhatsApp provider API.
- `interface/http/` solo traduce HTTP ↔ use cases.

## Dónde va cada archivo

| Qué | Dónde |
|---|---|
| Entidad | `src/domain/{feature}/entities/{name}.entity.ts` |
| Value object / enum de dominio | `src/domain/{feature}/value-objects/{name}.vo.ts` |
| Puerto de repositorio + token | `src/domain/{feature}/repositories/{name}.repository.ts` |
| Otros puertos (mensajería, LLM, agenda) | `src/domain/{feature}/ports/{name}.port.ts` |
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

La **conexión WhatsApp** vive en adaptadores de infraestructura desacoplados: el dominio del agente no
depende del mecanismo de vinculación (QR hoy; reemplazable mañana).

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
