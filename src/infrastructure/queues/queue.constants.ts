export const INBOUND_MESSAGES_QUEUE = 'inbound-messages';

// A client rarely says everything in one message, so the answer is a job of its
// own, held back long enough for the rest of the burst to land (`replyDebounceMs`).
export const INBOUND_MESSAGE_JOB = 'inbound';
export const CONVERSATION_REPLY_JOB = 'reply';
