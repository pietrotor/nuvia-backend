---
description: Controllers, DTOs de respuesta, auth y documentación Swagger
activation: paths
paths:
  - "src/interface/**/*.ts"
---

# Capa HTTP

## Controllers finos

Un controller traduce HTTP a un use case y nada más. Sin `if`s de negocio, sin acceso a repositorios, sin armar objetos de dominio.

```ts
@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly listAppointments: ListAppointmentsUseCase) {}

  @Get()
  @Auth(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Lista las citas del negocio' })
  @ApiResponse({ status: 200, type: [AppointmentResponseDto] })
  async findAll(@Query() pagination: PaginationDto): Promise<AppointmentResponseDto[]> {
    const appointments = await this.listAppointments.execute(pagination);

    return appointments.map(AppointmentResponseDto.from);
  }
}
```

El texto de Swagger va en español porque lo lee una persona; los identificadores, en inglés.

## Auth por defecto

**Todo endpoint declara auth explícitamente.** Un endpoint sin `@Auth()` solo se justifica en: login, el
seed de desarrollo, la página pública de reservas (booking page) y webhooks de WhatsApp (con verificación
de firma).

`@Auth(...roles)` recibe la lista completa de roles habilitados: `superadmin` no hereda permisos de tenant.
Un endpoint de configuración lleva `@Auth(Role.OWNER)`. Ver [multi-tenancy.md](multi-tenancy.md).

## Nunca devuelvas entidades crudas

Los controllers devuelven Response DTOs, no entidades de dominio. Una entidad tiene campos internos
(`password`, ids internos) que no deben salir por la API.

```ts
// MAL
return user;
// BIEN
return UserResponseDto.from(user.toPublic());
```

Si un endpoint devuelve datos de una clienta, revisá que no expongas más de lo necesario.

## Convenciones

- Params UUID siempre con `ParseUUIDPipe`.
- `@HttpCode(HttpStatus.CREATED)` en los POST que crean, `NO_CONTENT` en los DELETE (si aplica; preferí
  cambio de estado según el PRD: nada se borra).
- Swagger en el controller: `@ApiTags`, `@ApiOperation`, `@ApiResponse` con `type`. `@ApiProperty` va en el DTO.
- Prefijo global `/api/v1`. No hardcodees `/api/v1` en las rutas del controller.
- El `ValidationPipe` global ya tiene `whitelist` y `forbidNonWhitelisted`.
- Los errores no se arman en el controller: el `DomainExceptionFilter` global les da forma. Ver [errors.md](errors.md).

## Endpoints públicos

La página de reservas y los webhooks son públicos con rate limiting / verificación de firma. **Nunca**
exponen datos de otro tenant ni permiten enumerar recursos.

## Webhooks

Los webhooks del proveedor de WhatsApp son endpoints públicos con verificación de firma. Son idempotentes
por id del proveedor y responden rápido: el trabajo real va a una cola, no al handler. La capa de
conexión permanece desacoplada del agente.
