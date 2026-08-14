// Claims the agent can only make if a tool actually ran. The model writes fluent Spanish
// whether or not it called anything, so before an answer reaches the client we check that
// the actions it announces left a trace.
export enum OutboundClaim {
  BOOKING = 'booking',
  DEPOSIT_QR = 'deposit_qr',
}

// Left behind when a booking queued the deposit image. A booking on its own proves
// nothing about the QR: a service that charges no deposit books fine and sends no image,
// which is exactly how "en el siguiente mensaje te llega el QR" reached a client.
export const DEPOSIT_QR_QUEUED = 'deposit_qr_queued';

// The traces that prove each claim: a tool that ran, or the queued send above.
export const CLAIM_EVIDENCE: Readonly<Record<OutboundClaim, string[]>> = {
  [OutboundClaim.BOOKING]: ['book_appointment', 'reschedule_appointment'],
  [OutboundClaim.DEPOSIT_QR]: [DEPOSIT_QR_QUEUED, 'resend_deposit_qr'],
};

// Only assertions, never offers or questions: "¿confirmás para reservar?" must not trip the
// guard, while "listo, te reservo" must. Matching runs on accent-stripped lowercase text,
// which is why the patterns are written without accents.
const CLAIM_PATTERNS: Readonly<Record<OutboundClaim, RegExp[]>> = {
  [OutboundClaim.BOOKING]: [
    /\bte\s+(lo\s+)?(agendo|agende|agendamos|reservo|reserve|reservamos)\b/,
    /\b(ya\s+)?se\s+(agendo|reservo|confirmo)\b/,
    /\b(agende|reserve)\b/,
    /\bqued(o|aron)\s+(agendad|reservad|confirmad)/,
    /\bya\s+est(a|an)\s+(agendad|reservad|confirmad)/,
    /\b(tu|la)\s+(reserva|cita|turno)\s+(ya\s+)?(esta|quedo|fue)\b/,
    /\b(reserva|cita|turno)\s+(agendad|reservad|confirmad)[oa]\b/,
  ],
  [OutboundClaim.DEPOSIT_QR]: [
    /\bte\s+(llega|va\s+a\s+llegar|llegara)\s+(el|un)\s+qr\b/,
    // Past tense, with "ya" or without it, and whatever sits between the verb and the
    // noun: "ya te mandé el QR", "te reenví el QR".
    /\b(ya\s+)?te\s+(lo\s+)?(envie|enviamos|mande|mandamos|reenvie|reenviamos|reenvi)\b[^.\n]{0,16}\bqr\b/,
    /\bel\s+qr\s+(ya\s+)?(esta|deberia|salio)\b/,
    // The QR left implicit: resending is the only thing the agent ever resends.
    /\bte\s+(lo\s+)?(reenvio|reenvie|reenvi)\b/,
    /\b(deberias|vas\s+a)\s+recibir\s+(el|un)\s+qr\b/,
  ],
};

export function detectOutboundClaims(text: string): OutboundClaim[] {
  const normalized = normalize(text);

  return Object.values(OutboundClaim).filter((claim) =>
    CLAIM_PATTERNS[claim].some((pattern) => pattern.test(normalized)),
  );
}

// Claims the answer makes without a trace to back them.
export function unsupportedClaims(
  text: string,
  evidence: readonly string[],
): OutboundClaim[] {
  return detectOutboundClaims(text).filter(
    (claim) => !CLAIM_EVIDENCE[claim].some((proof) => evidence.includes(proof)),
  );
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
