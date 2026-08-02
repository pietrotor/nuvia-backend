---
description: Convenciones de schema de Drizzle, mappers, migraciones y manejo de dinero
activation: paths
paths:
  - "src/infrastructure/persistence/**/*.ts"
  - "drizzle/**"
  - "drizzle.config.ts"
---

# Persistencia (Drizzle + Postgres)

## Nombres

**snake_case en Postgres, camelCase en TypeScript.** Tablas en plural y en inglés (`users`, no `user`:
`user` es palabra reservada de Postgres y obliga a citarla en cualquier query a mano).

```ts
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    professionalId: uuid('professional_id')
      .notNull()
      .references(() => professionals.id),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: appointmentStatusEnum('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('appointments_tenant_idx').on(t.tenantId),
    index('appointments_professional_starts_idx').on(t.professionalId, t.startsAt),
  ],
);
```

Toda tabla lleva `id`, `tenant_id`, `created_at`, `updated_at` — ver [multi-tenancy.md](multi-tenancy.md).

## Dinero

**Siempre `numeric(12, 2)`. Nunca `real`, `double precision` ni `float`.** Un centavo perdido por redondeo
binario es un incidente de confianza. Al leer, convertí explícitamente.

Los montos del PRD están en Bolivianos (Bs). No guardes moneda por fila: V1 es mono-moneda.

## Estados, no borrado

El PRD: **nada se borra**. Cancelaciones, plantones y cortes cambian estados. Usá una columna `status`
con `pgEnum`, no un soft-delete genérico ni `DELETE` en flujos de negocio.

```ts
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pending_deposit',
  'confirmed',
  'attended',
  'no_show',
  'cancelled',
  'released', // seña no pagada a tiempo
]);
```

Las transiciones relevantes quedan auditables (eventos o `audit_logs`) cuando cambian dinero o agenda.

## Mappers

Estáticos, en `drizzle/mappers/`, con `toDomain` (y `toPersistence` cuando el insert no es trivial). Son la
única frontera donde la fila de la base se convierte en entidad.

```ts
export class AppointmentMapper {
  static toDomain(row: AppointmentSchema): Appointment {
    return new Appointment({ /* ... */ });
  }
}
```

Siempre chequeá el `undefined` antes de mapear: `return row ? AppointmentMapper.toDomain(row) : null`.

## Migraciones

```bash
yarn db:generate   # después de tocar cualquier *.schema.ts
yarn db:migrate
```

Nunca edites a mano un `.sql` ya generado ni el `meta/_journal.json`. Toda tabla nueva se exporta desde
`drizzle/schema/index.ts` o Drizzle no la ve.
