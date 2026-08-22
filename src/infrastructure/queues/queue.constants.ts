export const INBOUND_MESSAGES_QUEUE = 'inbound-messages';
export const APPOINTMENT_NOTIFICATIONS_QUEUE = 'appointment-notifications';

// A client rarely says everything in one message, so the answer is a job of its
// own, held back long enough for the rest of the burst to land (`replyDebounceMs`).
export const INBOUND_MESSAGE_JOB = 'inbound';
export const CONVERSATION_REPLY_JOB = 'reply';

// The owner toggled the human-attention label from her phone: pause/resume the
// bot to match. Kept off the webhook request path like every other side effect.
export const LABEL_ASSOCIATION_JOB = 'label-association';

// The instance just connected: find-or-create the human-attention label so it
// exists before the first handoff needs it.
export const LABEL_ENSURE_JOB = 'label-ensure';

export const NOTIFICATION_DISPATCH_JOB = 'notification-dispatch';
export const NOTIFICATION_SEND_JOB = 'notification-send';
export const NOTIFICATION_STATUS_JOB = 'notification-status';

export const APPOINTMENT_REMINDERS_QUEUE = 'appointment-reminders';
export const REMINDER_DISPATCH_JOB = 'reminder-dispatch';
export const REMINDER_SEND_JOB = 'reminder-send';
