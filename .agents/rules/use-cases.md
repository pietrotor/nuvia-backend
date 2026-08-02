---
description: Forma canónica de un use case y de los puertos que consume
activation: paths
paths:
  - "src/application/**/*.ts"
---

# Use cases

Un use case = una operación de negocio = una clase `@Injectable()` con un único método público `execute()`.

```ts
@Injectable()
export class VerifyDepositUseCase {
  constructor(
    @Inject(DEPOSIT_REPOSITORY)
    private readonly depositRepository: DepositRepository,
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
  ) {}

  async execute(dto: VerifyDepositDto): Promise<Appointment> {
    const deposit = await this.depositRepository.findById(dto.depositId);
    if (!deposit) throw new DepositNotFoundError(dto.depositId);
    // orquestación; las decisiones de negocio las toman las entidades
  }
}
```

Reglas:

- **Siempre** `@Injectable()`. Sin el decorador, Nest resuelve las dependencias solo por casualidad.
- **Siempre** tipo de retorno explícito en `execute()`.
- Los repositorios y puertos se inyectan con `@Inject(TOKEN)`. Los servicios concretos de infraestructura (`BcryptService`, `JwtService`) se inyectan por clase.
- El use case **no** conoce HTTP: no recibe `Request`, no lanza `NotFoundException`, no devuelve status codes. Ver [errors.md](errors.md).
- El use case **no** arma SQL ni toca Drizzle. Todo acceso a datos pasa por un puerto.

## Nombres

`{Verb}{Noun}UseCase` en inglés, archivo en kebab-case: `verify-deposit.use-case.ts` →
`VerifyDepositUseCase`.

Un solo use case por operación. **Prohibido** tener dos use cases que hacen lo mismo con nombres distintos (`find-*` y `get-*` en paralelo): si necesitás la variante que devuelve `null` y la que tira 404, es un solo use case y la decisión la toma quien lo llama, o es un método del repositorio.

## Puertos

Los puertos se declaran en `domain/` junto a su token, y el token es un string con el nombre de la interfaz:

```ts
export interface AppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  save(appointment: Appointment): Promise<Appointment>;
}

export const APPOINTMENT_REPOSITORY = 'AppointmentRepository';
```

Todos los tokens de repositorio se registran en `PersistenceModule` y **solo ahí**. Registrar el mismo
`{ provide: TOKEN, useClass: Impl }` en varios módulos crea instancias distintas y es una fuente de bugs
silenciosos.

## DTOs

Input DTOs con `class-validator` **y** `@ApiProperty`. Nada de validar a mano dentro del use case lo que un
decorador ya valida, y nada de JSDoc: el `example` del `@ApiProperty` ya documenta el campo.

```ts
export class VerifyDepositDto {
  @ApiProperty({ example: 'uuid', description: 'Id de la seña a verificar' })
  @IsUUID()
  depositId: string;
}
```

Para updates: `extends PartialType(CreateXDto)` de `@nestjs/swagger`. Para listados paginados: reutilizá
`application/common/dto/pagination.dto.ts`, no escribas otro.

Los DTOs de **respuesta** viven en `interface/http/{feature}/dto/` con un `static from(...)` que recibe la
entidad. Un use case devuelve entidades o un tipo propio, nunca la fila de la base.
