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
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'El archivo que enviaste es demasiado grande.',
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
  [ErrorCode.STORAGE_NOT_CONFIGURED]:
    'El almacenamiento de archivos todavía no está configurado.',
  [ErrorCode.STORAGE_OBJECT_NOT_FOUND]:
    'No encontramos ese archivo. Volvé a subirlo.',
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
  [ErrorCode.AGENT_TRACE_NOT_FOUND]: 'No encontramos esa traza del agente.',
  [ErrorCode.PROFESSIONAL_NOT_FOUND]: 'No encontramos esa profesional.',
  [ErrorCode.SERVICE_NOT_FOUND]: 'No encontramos ese servicio.',
  [ErrorCode.BRANCH_NOT_FOUND]: 'No encontramos esa sucursal.',
  [ErrorCode.BRANCH_REQUIRED]:
    'Elegí una sucursal para continuar con la reserva.',
  [ErrorCode.SERVICE_NOT_OFFERED_AT_BRANCH]:
    'Ese servicio no se ofrece en la sucursal elegida.',
  [ErrorCode.PROFESSIONAL_NOT_AT_BRANCH]:
    'Esa profesional no atiende en la sucursal elegida.',
  [ErrorCode.SERVICE_OFFER_WINDOW_EMPTY]:
    'Ese horario por servicio no coincide con ningún momento en que la profesional atienda en la sucursal. Ajustá los días u horas.',
  [ErrorCode.SERVICE_OFFER_WINDOW_NOT_FOUND]:
    'No hay un horario personalizado para ese servicio en esta sucursal.',
  [ErrorCode.PROFESSIONAL_DOES_NOT_PERFORM_SERVICE]:
    'Esa profesional no está asignada a ese servicio en el catálogo.',
  [ErrorCode.CLIENT_NOT_FOUND]: 'No encontramos esa clienta.',
  [ErrorCode.CLIENT_PHONE_ALREADY_REGISTERED]:
    'Ya existe una clienta con el teléfono {phoneE164}.',
  [ErrorCode.CLIENT_NAME_REQUIRED]:
    'Necesitamos el nombre de quien va a atenderse para poder reservar.',
  [ErrorCode.BOOKING_ANSWERS_INCOMPLETE]:
    'Faltan respuestas obligatorias para este servicio.',
  [ErrorCode.BOOKING_QUESTION_NOT_FOUND]:
    'Esa pregunta de reserva ya no está disponible.',
  [ErrorCode.BOOKING_ANSWER_INVALID]:
    'La respuesta a una pregunta de reserva no es válida.',
  [ErrorCode.BUSINESS_CONFIG_NOT_FOUND]: 'Falta la configuración del negocio.',
  [ErrorCode.DEPOSIT_QR_NOT_FOUND]: 'No encontramos ese QR de cobro.',
  [ErrorCode.INVALID_DEPOSIT_QR_FILE]:
    'Subí una imagen PNG, JPG o WEBP de hasta {maxSizeMb} MB.',
  [ErrorCode.INVALID_DEPOSIT_RECEIPT_FILE]:
    'Subí un comprobante PNG, JPG o WEBP de hasta {maxSizeMb} MB.',
  [ErrorCode.DEPOSIT_RECEIPT_NOT_FOUND]:
    'Esta cita todavía no tiene un comprobante.',
  [ErrorCode.DEPOSIT_QR_REQUIRES_DEPOSIT_SERVICE]:
    'Solo podés asignar un QR a un servicio que cobra seña.',
  [ErrorCode.PROFESSIONAL_AVATAR_NOT_FOUND]:
    'Esa profesional todavía no tiene foto.',
  [ErrorCode.INVALID_PROFESSIONAL_AVATAR_FILE]:
    'Subí una imagen PNG, JPG o WEBP de hasta {maxSizeMb} MB.',
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
  [ErrorCode.PLAN_NOT_FOUND]: 'No encontramos ese plan.',
  [ErrorCode.PLAN_CODE_ALREADY_EXISTS]:
    'Ya existe un plan con el código {code}.',
  [ErrorCode.PLAN_CONFIG_INVALID]:
    'La configuración del plan no es válida ({path}).',
  [ErrorCode.PLAN_LIMIT_REACHED]:
    'Tu plan permite hasta {limit} {resource}. Escribinos para ampliarlo.',
  [ErrorCode.PLAN_FEATURE_NOT_AVAILABLE]:
    'Tu plan no incluye {feature}. Escribinos para ampliarlo.',
  [ErrorCode.SUBSCRIPTION_NOT_FOUND]:
    'Este negocio todavía no tiene una suscripción activa.',
  [ErrorCode.SUBSCRIPTION_ALREADY_EXISTS]:
    'Este negocio ya tiene una suscripción vigente.',
  [ErrorCode.SUBSCRIPTION_INVALID_PERIOD]:
    'El período de la suscripción no es válido.',
  [ErrorCode.INTERNAL_ERROR]: 'Ocurrió un error interno. Intentá de nuevo.',
  [ErrorCode.NOTIFICATION_CONTACT_NOT_FOUND]:
    'No encontramos ese contacto de avisos.',
  [ErrorCode.NOTIFICATION_SUBSCRIPTION_NOT_FOUND]:
    'No encontramos esa suscripción de avisos.',
  [ErrorCode.NOTIFICATION_PHONE_ALREADY_REGISTERED]:
    'Ese WhatsApp ya está configurado para avisos.',
  [ErrorCode.NOTIFICATION_PROFESSIONAL_ALREADY_SUBSCRIBED]:
    'Esa profesional ya tiene un número para avisos de citas.',
  [ErrorCode.NOTIFICATION_BRANCH_OBSERVER_LIMIT]:
    'Esta sucursal ya tiene el máximo de {limit} números observadores.',
  [ErrorCode.NOTIFICATION_CONTACT_DEACTIVATED]:
    'Ese número ya no recibe avisos. Configurá uno nuevo si hace falta.',
  [ErrorCode.OUTBOUND_DEFERRED]:
    'WhatsApp está ocupado. El aviso se va a enviar en un momento.',
  [ErrorCode.OUTBOUND_BLOCKED]:
    'Los envíos automáticos de WhatsApp están pausados para este negocio.',
  [ErrorCode.INVALID_CLIENT_REMINDER_POLICY]:
    'Elegí hasta tres avisos de la lista (24 h, 12 h, 2 h o 30 min). Si están activos, tiene que haber al menos uno.',
  [ErrorCode.INVALID_PHONE_NUMBER]:
    'Revisá el número de teléfono e intentá de nuevo.',
  [ErrorCode.PHONE_EXTENSION_NOT_SUPPORTED]:
    'No admitimos extensiones telefónicas. Ingresá el número directo.',
  [ErrorCode.UNSUPPORTED_COUNTRY_CODE]: 'Ese país no está disponible todavía.',
};
