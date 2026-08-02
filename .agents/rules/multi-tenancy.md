---
description: Aislamiento estricto por tenant en schema, repositorios, auth y jobs
activation: paths
paths:
  - "src/**/*.ts"
---

# Multi-tenancy

Un leak entre tenants es un incidente crítico. Estas reglas no son negociables ni "para después".

## Toda tabla lleva tenant_id

```ts
tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
// + index('{table}_tenant_idx').on(t.tenantId)
```

Sin excepciones salvo `tenants` misma. `users` y `audit_logs` lo tienen nullable porque el `superadmin` no
pertenece a ningún negocio; cualquier otra tabla lo lleva `notNull()`. Si te parece que una tabla no
necesita `tenant_id` porque "es global", preguntá antes.

## El tenant sale del token, nunca del request

El JWT es `{ sub, tenantId, role }` y la `JwtStrategy` es el **único** lugar que llena el contexto de
tenant. Además revalida contra la base en cada request.

```ts
// BIEN — el tenant viene del token, la URL habla del recurso
@Patch('me')
@Auth(Role.OWNER)
update(@CurrentTenant() tenantId: string, @Body() dto: UpdateTenantDto) {
  return this.updateTenant.execute(tenantId, dto);
}

// MAL — el cliente elige de qué tenant leer
@Get(':tenantId/appointments')
list(@Param('tenantId') tenantId: string) { }
```

Prohibido aceptar `tenantId` por param, query o body en cualquier endpoint autenticado. La única excepción
son los endpoints de `superadmin`, que quedan registrados en `audit_logs`.

## Los repositorios no pueden escapar del scope

Todo repositorio de una tabla con tenant extiende `TenantScopedRepository` y usa sus helpers
(`selectFrom`, `insertInto`, `updateIn`, `deleteFrom`). **Prohibido usar `drizzle.db` directo** para esas
tablas, salvo con `this.scope(table, ...)` en el `where` cuando el query no se puede expresar con los
helpers (joins, agregados).

```ts
// BIEN
async findConfirmedForDay(day: Date): Promise<Appointment[]> {
  const rows = await this.selectFrom(appointments, eq(appointments.status, 'confirmed'));
  return rows.map(AppointmentMapper.toDomain);
}

// BIEN — join, con el scope explícito
const rows = await this.drizzle.db
  .select()
  .from(appointments)
  .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
  .where(this.scope(appointments, eq(appointments.status, 'confirmed')));

// MAL — citas de todos los tenants
const rows = await this.drizzle.db.select().from(appointments);
```

Los helpers leen el tenant del `AsyncLocalStorage` **antes** de armar el query y lanzan
`TenantContextMissingError` si no hay contexto.

En los `INSERT` el `tenant_id` lo pone el repositorio desde el contexto, nunca el caller. Los métodos que
por necesidad no están scopeados (login, validación de token, alta de superadmin) llevan el sufijo
`Unscoped` en el nombre del puerto.

Un `findById` de otro tenant devuelve `null`, y el use case lo traduce a 404: nunca 403.

## Jobs, crons y webhooks

No tienen request, así que no tienen contexto automático. Abrilo explícitamente:

```ts
await this.tenantContext.runWithTenant(tenantId, async () => {
  await this.sendAppointmentReminders.execute({ now });
});
```

Un cron que itera tenants abre un contexto **por tenant**, nunca uno solo para todos.

## Roles

`owner` y `staff` son roles **dentro** de un tenant; `superadmin` es nuestro, cross-tenant y no hereda
permisos de tenant.

- `owner` configura el negocio, verifica señas, opera agenda y conversaciones.
- `staff` (si existe en el tenant) opera el día a día; no toca configuración sensible del negocio ni
  facturación SaaS sin que el endpoint lo declare.

Todo endpoint declara su rol mínimo con `@Auth(...)`. Un endpoint sin decorador de auth es un bug,
salvo login, seed, booking page pública y webhooks firmados.

## Tests

Cualquier feature que toque datos de tenant suma un caso al e2e de `test/multi-tenancy.e2e-spec.ts`: dos
tenants, y el de A no ve ni toca lo de B.
