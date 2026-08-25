import { AgentActionEvidence, AgentActionOperation } from './agent-action';

// Claims the agent can only make if a committed action left evidence. The model writes
// fluent Spanish whether or not it called anything, so before an answer reaches the
// client we check that the actions it announces left a resource-bound trace.
export enum OutboundClaim {
  BOOKING = 'booking',
  RESCHEDULE = 'reschedule',
  CANCELLATION = 'cancellation',
  DEPOSIT_QR = 'deposit_qr',
  DEPOSIT_RECEIPT_ASSIGNMENT = 'deposit_receipt_assignment',
  DEPOSIT_RECEIPT_EXPECTATION = 'deposit_receipt_expectation',
  HANDOFF = 'handoff',
  CLIENT_NAME = 'client_name',
  BRANCH_SELECTION = 'branch_selection',
  // Never produced by an agent tool: only the owner verification flow confirms a payment.
  PAYMENT_VERIFIED = 'payment_verified',
}

// Left behind when a booking queued the deposit image. A booking on its own proves
// nothing about the QR: a service that charges no deposit books fine and sends no image,
// which is exactly how "en el siguiente mensaje te llega el QR" reached a client.
export const DEPOSIT_QR_QUEUED: AgentActionOperation = 'deposit.qr_queued';

// Operations that prove each claim. Empty means the agent can never authorize it.
export const CLAIM_EVIDENCE: Readonly<
  Record<OutboundClaim, readonly AgentActionOperation[]>
> = {
  [OutboundClaim.BOOKING]: ['appointment.book'],
  [OutboundClaim.RESCHEDULE]: ['appointment.reschedule'],
  [OutboundClaim.CANCELLATION]: ['appointment.cancel'],
  [OutboundClaim.DEPOSIT_QR]: ['deposit.qr_queued', 'deposit.qr_sent'],
  [OutboundClaim.DEPOSIT_RECEIPT_ASSIGNMENT]: ['deposit.receipt_assigned'],
  [OutboundClaim.DEPOSIT_RECEIPT_EXPECTATION]: ['deposit.receipt_expected'],
  [OutboundClaim.HANDOFF]: ['conversation.handoff'],
  [OutboundClaim.CLIENT_NAME]: ['client.name_confirmed'],
  [OutboundClaim.BRANCH_SELECTION]: ['conversation.branch_set'],
  [OutboundClaim.PAYMENT_VERIFIED]: [],
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
  [OutboundClaim.RESCHEDULE]: [
    /\bte\s+(lo\s+)?(reagende|reagendo|reagendamos|movi|movemos)\b/,
    /\b(ya\s+)?(reagende|movi)\b/,
    /\bqued(o|aron)\s+reagendad/,
    /\bya\s+est(a|an)\s+reagendad/,
    /\b(tu|la)\s+(reserva|cita|turno)\s+(ya\s+)?(quedo|esta|fue)\s+reagendad/,
    /\b(reserva|cita|turno)\s+reagendad[oa]\b/,
    /\b(cambie|cambiamos)\s+(tu|la)\s+(reserva|cita|turno|horario)\b/,
  ],
  [OutboundClaim.CANCELLATION]: [
    /\b(ya\s+)?(cancele|cancelamos|cancelo)\b/,
    /\bte\s+(la\s+)?(cancele|cancelamos|cancelo)\b/,
    /\bqued(o|aron)\s+cancelad/,
    /\bya\s+est(a|an)\s+cancelad/,
    /\b(tu|la)\s+(reserva|cita|turno)\s+(ya\s+)?(quedo|esta|fue)\s+cancelad/,
    /\b(reserva|cita|turno)\s+cancelad[oa]\b/,
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
  [OutboundClaim.DEPOSIT_RECEIPT_ASSIGNMENT]: [
    /\bcomprobante\s+(ya\s+)?(quedo|esta)\s+(asignad|corregid)/,
    /\b(ya\s+)?(asigne|corregi|movi)\b[^.\n]{0,24}\bcomprobante\b/,
    /\b(el|ese|tu)\s+comprobante\s+(quedo|es|era)\s+para\b/,
    /\bcomprobante\s+(ya\s+)?(quedo|esta)\s+para\b/,
    /\b(ya\s+)?(pase|movi)\b[^.\n]{0,20}\bcomprobante\b/,
  ],
  [OutboundClaim.DEPOSIT_RECEIPT_EXPECTATION]: [
    /\b(la\s+)?proxima\s+(imagen|captura|foto|comprobante)\s+(va|quedara|la\s+asignare)\b/,
    /\bcuando\s+(la\s+)?(mandes|envies)\b[^.\n]{0,32}\b(la\s+)?(asignare|pondre|tomare)\b/,
  ],
  [OutboundClaim.HANDOFF]: [
    /\b(ya\s+)?(avise|notifique)\b[^.\n]{0,24}\b(equipo|persona|alguien)\b/,
    /\b(ya\s+)?(derive|derivo|pase)\b[^.\n]{0,24}\b(equipo|persona|humano)\b/,
    /\bel\s+equipo\s+(ya\s+)?(fue|quedo|esta)\s+(avisad|notificad)/,
    /\b(te\s+)?(derive|derivo)\s+con\s+(el\s+)?(equipo|una\s+persona)\b/,
  ],
  [OutboundClaim.CLIENT_NAME]: [
    /\b(ya\s+)?(guarde|registre|anote)\b[^.\n]{0,24}\b(tu\s+)?nombre\b/,
    /\b(tu\s+)?nombre\s+(ya\s+)?(quedo|esta)\s+(guardad|registrad)/,
    /\bya\s+te\s+(tengo|deje)\s+(registrad|anotad)/,
  ],
  [OutboundClaim.BRANCH_SELECTION]: [
    /\b(ya\s+)?(fije|deje|dejamos|quedamos)\b[^.\n]{0,32}\b(sucursal|local)\b/,
    /\b(la\s+)?sucursal\s+(ya\s+)?(quedo|esta)\s+(fijad|elegid|seleccionad)/,
    /\bquedamos\s+en\s+(la\s+)?(sucursal|local)\b/,
  ],
  [OutboundClaim.PAYMENT_VERIFIED]: [
    /\b(tu\s+)?(pago|sena)\s+(ya\s+)?(quedo|esta|fue)\s+(confirmad|verificad|aprobad|recibid)/,
    /\b(ya\s+)?(verifique|confirme|recibi)\b[^.\n]{0,24}\b(pago|sena|comprobante)\b/,
    /\bel\s+equipo\s+(ya\s+)?(verifico|confirmo)\b[^.\n]{0,24}\b(pago|sena)\b/,
  ],
};

export function detectOutboundClaims(text: string): OutboundClaim[] {
  const normalized = dropInterrogatives(normalize(text));

  return Object.values(OutboundClaim).filter((claim) =>
    CLAIM_PATTERNS[claim].some((pattern) => pattern.test(normalized)),
  );
}

// Stripping accents makes the subjunctive of an offer identical to the past tense of a
// claim ("¿querés que te reenvíe el QR?" reads as "ya te reenvié el QR"), so an offer to
// resend used to trip the guard and hand the client off mid-conversation. Questions are
// dropped before matching: an answer that asks announces nothing. A claim buried inside a
// question ("ya te reenvié el QR, ¿lo viste?") goes unflagged, which is the cheaper
// mistake — the guard replaces the answer and pauses the bot when it fires.
function dropInterrogatives(text: string): string {
  return text
    .replace(/¿[^?]*\??/g, ' ')
    .split(/(?<=[.!\n])/)
    .filter((sentence) => !sentence.trim().endsWith('?'))
    .join(' ');
}

// Claims the answer makes without a committed operation to back them.
export function unsupportedClaims(
  text: string,
  evidence: readonly AgentActionEvidence[],
): OutboundClaim[] {
  const operations = new Set(evidence.map((item) => item.operation));
  return detectOutboundClaims(text).filter(
    (claim) => !CLAIM_EVIDENCE[claim].some((proof) => operations.has(proof)),
  );
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
