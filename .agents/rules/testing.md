---
description: Qué se testea obligatoriamente y cómo se escriben los tests
activation: paths
paths:
  - "src/**/*.spec.ts"
  - "test/**/*.ts"
  - "jest.config.*"
---

# Testing

Los tests van junto al archivo que testean: `verify-deposit.use-case.spec.ts` al lado de
`verify-deposit.use-case.ts`. Los e2e en `test/`.

## Cómo

- **Entidades:** sin mocks. Son TypeScript puro, se instancian y se verifican los métodos de negocio.
- **Use cases:** se mockean los puertos. No se mockea Drizzle ni se levanta base de datos.
- **Repositorios y e2e:** contra Postgres real (el de `docker-compose`), con datos de al menos **dos
  tenants** para que un test de aislamiento pueda fallar de verdad.

```ts
let appointmentRepository: jest.Mocked<Pick<AppointmentRepository, 'findById' | 'save'>>;

beforeEach(() => {
  appointmentRepository = { findById: jest.fn(), save: jest.fn() };
  useCase = new VerifyDepositUseCase(
    appointmentRepository as unknown as AppointmentRepository,
  );
});
```

Mockeá con `Pick<>` los métodos que el test usa en vez de castear todo a `any`: si mañana alguien agrega
una llamada al puerto, el test falla al compilar en vez de pasar con un `undefined`.

Los nombres de los `it()` describen el comportamiento, no el método, y van en inglés como el resto del
código: `it('does not confirm the appointment when the deposit is unverified')`, no
`it('should call confirm')`.

## Tests obligatorios (reglas del PRD)

Estas reglas críticas necesitan un test nombrado y explícito. Una feature que las toca no está terminada sin su test:

- **Aislamiento multi-tenant:** un usuario del tenant A no puede leer ni modificar nada del tenant B,
  endpoint por endpoint. Se suma el caso a `test/multi-tenancy.e2e-spec.ts`.
- **Guard de repositorio:** un repositorio usado fuera de contexto de tenant lanza excepción.
- **Contexto entre requests concurrentes:** el tenant de una request no se filtra a otra.
- **Disponibilidad de agenda:** nunca se confirma una cita en un slot ocupado, fuera de horario o bloqueado
  (incluida la carrera entre WhatsApp, panel y web).
- **Seña:** una cita con seña requerida no pasa a confirmada sin verificación manual.
- **Paquetes:** marcar atendida descuenta exactamente una sesión; el saldo no se desincroniza.
- **Nada se borra:** cancelar / plantón cambia estado, no elimina la fila.
- **Idempotencia de recordatorios / webhooks:** correr el cron o reentregar el webhook no duplica efectos.
- **Carrera verificación-vs-envío:** seña verificada cancela recordatorios de seña pendientes.
- **Permisos por rol:** `staff` recibe 403 en endpoints de configuración del negocio cuando corresponda.

Los 8 flujos end-to-end del PRD (sección 5) son los casos de prueba de aceptación de la V1.

## Setup

```bash
yarn test                          # unit, sin base de datos
yarn test:e2e                      # e2e, necesita el Postgres de docker-compose
```

El `moduleNameMapper` de los path aliases (`@domain/*`, etc.) está en dos lugares: el bloque `jest` de
`package.json` y `test/jest-e2e.json`. Si agregás un alias a `tsconfig.json`, agregalo en los dos.

El e2e corre el seed, así que **borra los datos de la base local**.

No escribas tests que dependan de la hora del sistema sin controlarla: recordatorios y deadlines de seña
se testean con reloj inyectado o `jest.useFakeTimers()`.
