import { ErrorCode } from '@domain/common/exceptions';

export const es: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_CREDENTIALS]: 'Email o contraseña incorrectos.',
  [ErrorCode.USER_INACTIVE]:
    'Tu usuario está desactivado. Hablá con el administrador del negocio.',
  [ErrorCode.SESSION_TENANT_MISMATCH]:
    'Tu sesión ya no es válida. Volvé a iniciar sesión.',
  [ErrorCode.INSUFFICIENT_ROLE]: 'No tenés permisos para hacer esto.',

  [ErrorCode.TENANT_NOT_FOUND]: 'No encontramos el negocio solicitado.',
  [ErrorCode.TENANT_SUSPENDED]:
    'La cuenta de {name} está suspendida. Escribinos para reactivarla.',

  [ErrorCode.USER_NOT_FOUND]: 'No encontramos ese usuario.',
  [ErrorCode.EMAIL_ALREADY_REGISTERED]: 'Ya existe una cuenta con {email}.',
  [ErrorCode.CANNOT_DEMOTE_LAST_OWNER]:
    'El negocio necesita al menos un propietario. Asigná otro antes de cambiar este rol.',
  [ErrorCode.SUPERADMIN_CANNOT_BELONG_TO_TENANT]:
    'Un superadmin no puede pertenecer a un negocio.',

  [ErrorCode.VALIDATION_FAILED]: 'Revisá los datos enviados.',
  [ErrorCode.DUPLICATE_RECORD]: 'Ese registro ya existe.',
  [ErrorCode.RELATED_RECORD_NOT_FOUND]:
    'No se puede completar la operación: falta un registro relacionado.',
  [ErrorCode.REQUIRED_FIELD_MISSING]: 'Falta completar el campo {field}.',
  [ErrorCode.CONSTRAINT_VIOLATION]:
    'Los datos enviados no cumplen una validación del sistema.',
  [ErrorCode.TENANT_CONTEXT_MISSING]:
    'Ocurrió un error interno. Ya estamos revisándolo.',
  [ErrorCode.SEED_DISABLED]: 'El seed está deshabilitado en este entorno.',
  [ErrorCode.INTERNAL_ERROR]: 'Ocurrió un error interno. Intentá de nuevo.',
};
