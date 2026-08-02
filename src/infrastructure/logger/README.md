# Logger System

Sistema de logging basado en Winston con rotación diaria de archivos y múltiples niveles de log.

## Características

- **Múltiples transports**: Consola y archivos
- **Rotación diaria**: Los logs se rotan automáticamente cada día
- **Logs separados**: Archivo general y archivo específico para errores
- **Formato estructurado**: JSON para archivos, formato legible para consola
- **Retención automática**:
  - Logs generales: 14 días
  - Logs de errores: 30 días
- **Compresión**: Los archivos antiguos se comprimen automáticamente

## Uso

### En Use Cases

```typescript
import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '@infrastructure/logger';

@Injectable()
export class MyUseCase {
  constructor(private readonly logger: AppLoggerService) {}

  async execute() {
    this.logger.log('Operation started', 'MyUseCase');

    try {
      // ... tu lógica
      this.logger.log('Operation completed successfully', 'MyUseCase');
    } catch (error) {
      this.logger.error('Operation failed', error.stack, 'MyUseCase');
      throw error;
    }
  }
}
```

### Niveles de Log

```typescript
// Info general
logger.log('User logged in', 'AuthUseCase');

// Advertencias
logger.warn('Rate limit approaching', 'RateLimiter');

// Errores
logger.error('Database connection failed', stackTrace, 'DatabaseService');

// Debug (solo en desarrollo)
logger.debug('Query executed', 'Repository');

// Verbose
logger.verbose('Cache hit', 'CacheService');
```

### Métodos Especiales

```typescript
// Log de errores de base de datos
logger.logDatabaseError(error, 'CreateUserUseCase');

// Log de requests HTTP
logger.logRequest('POST', '/api/users', 201, 'UsersController');

// Log de eventos de autenticación
logger.logAuth('login', 'user@example.com', true);
```

## Estructura de Archivos

```
logs/
├── application-2025-11-15.log      # Logs generales del día
├── application-2025-11-14.log.gz   # Logs comprimidos de días anteriores
├── error-2025-11-15.log            # Solo errores del día
└── error-2025-11-14.log.gz         # Errores comprimidos
```

## Formato de Logs

### En archivos (JSON)
```json
{
  "level": "error",
  "message": "Database error",
  "context": "CreateUserUseCase",
  "code": "23505",
  "timestamp": "2025-11-15 10:30:45"
}
```

### En consola (formato NestJS)
```
[DomuBackend] 37639  - 11/15/2025, 10:30:45 AM   ERROR [CreateUserUseCase] Database error
```

## Configuración

La configuración se encuentra en `winston.config.ts`:

- `maxSize`: Tamaño máximo por archivo (20MB)
- `maxFiles`: Días de retención (14d para general, 30d para errores)
- `datePattern`: Patrón de fecha para rotación (YYYY-MM-DD)
- `zippedArchive`: Compresión automática (true)

## DatabaseErrorHandler

El `DatabaseErrorHandler` ahora usa automáticamente el logger para registrar todos los errores de base de datos:

```typescript
try {
  // Operación de base de datos
} catch (error) {
  // Automáticamente logea el error y lanza excepción HTTP apropiada
  DatabaseErrorHandler.handle(error, 'CreateUserUseCase');
}
```

## Variables de Entorno

No se requieren variables de entorno adicionales. Los logs se guardan en la carpeta `logs/` en la raíz del proyecto.
