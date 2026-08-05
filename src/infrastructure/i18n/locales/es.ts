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
  [ErrorCode.MESSAGING_NOT_CONFIGURED]:
    'La mensajería de WhatsApp todavía no está configurada.',
  [ErrorCode.EVOLUTION_API_ERROR]:
    'No pudimos comunicarnos con WhatsApp. Intentá nuevamente.',
  [ErrorCode.WHATSAPP_SESSION_NOT_CONNECTED]:
    'El negocio todavía no vinculó su WhatsApp.',
  [ErrorCode.WHATSAPP_SESSION_ALREADY_CONNECTED]:
    'El WhatsApp ya está vinculado. No hace falta escanear otro código.',
  [ErrorCode.LLM_NOT_CONFIGURED]:
    'El proveedor de IA todavía no está configurado.',
  [ErrorCode.LLM_PROVIDER_ERROR]:
    'El asistente no pudo procesar el mensaje. Intentá nuevamente.',
  [ErrorCode.AGENT_PROMPT_INCOMPLETE]:
    'El asistente no está configurado correctamente.',
  [ErrorCode.SLOT_UNAVAILABLE]: 'Ese horario ya no está disponible.',
  [ErrorCode.APPOINTMENT_NOT_FOUND]: 'No encontramos esa cita.',
  [ErrorCode.INVALID_APPOINTMENT_TRANSITION]:
    'El estado actual de la cita no permite ese cambio.',
  [ErrorCode.CONVERSATION_NOT_FOUND]: 'No encontramos esa conversación.',
  [ErrorCode.PROFESSIONAL_NOT_FOUND]: 'No encontramos esa profesional.',
  [ErrorCode.SERVICE_NOT_FOUND]: 'No encontramos ese servicio.',
  [ErrorCode.CLIENT_NOT_FOUND]: 'No encontramos esa clienta.',
  [ErrorCode.BUSINESS_CONFIG_NOT_FOUND]: 'Falta la configuración del negocio.',
  [ErrorCode.SCHEDULE_BLOCK_NOT_FOUND]: 'No encontramos ese bloqueo de agenda.',
  [ErrorCode.INVALID_WEEKLY_HOURS]:
    'Los horarios deben tener formato HH:mm y terminar después de comenzar.',
  [ErrorCode.INVALID_DEPOSIT_CONFIGURATION]:
    'Configurá exactamente un monto o un porcentaje cuando el servicio requiera seña.',
  [ErrorCode.INVALID_AMOUNT]:
    'El monto debe ser un número positivo con hasta dos decimales.',
  [ErrorCode.INVALID_TIME_RANGE]:
    'La hora de finalización debe ser posterior a la hora de inicio.',
  [ErrorCode.INVALID_WEBHOOK]: 'Webhook inválido.',
  [ErrorCode.INTERNAL_ERROR]: 'Ocurrió un error interno. Intentá de nuevo.',
};
