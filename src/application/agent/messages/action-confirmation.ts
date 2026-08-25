import {
  AgentActionEvidence,
  AgentCommittedAction,
} from '@domain/agent/services/agent-action';
import { OutboundClaim } from '@domain/agent/services/outbound-claim';
import { AgentOutboundCopy } from './agent-outbound.copy';

// Authoritative confirmations for mutations. The LLM may chat before the action; once a
// use case commits, only this copy may tell the client what changed.
export function renderActionConfirmation(
  action: AgentCommittedAction,
  options: { depositQrQueued?: boolean } = {},
): string | null {
  switch (action.operation) {
    case 'appointment.book':
      return renderBooking(action, options.depositQrQueued === true);
    case 'appointment.cancel':
      return renderCancellation(action);
    case 'appointment.reschedule':
      return renderReschedule(action);
    default:
      return null;
  }
}

export function pickConfirmationAction(
  actions: readonly AgentCommittedAction[],
): AgentCommittedAction | null {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index];
    if (
      action.operation === 'appointment.book' ||
      action.operation === 'appointment.cancel' ||
      action.operation === 'appointment.reschedule'
    ) {
      return action;
    }
  }
  return null;
}

export function fallbackCopyForClaims(
  claims: readonly OutboundClaim[],
): string {
  if (claims.includes(OutboundClaim.BOOKING)) {
    return AgentOutboundCopy.unverifiedBooking;
  }
  if (claims.includes(OutboundClaim.CANCELLATION)) {
    return AgentOutboundCopy.unverifiedCancellation;
  }
  if (claims.includes(OutboundClaim.RESCHEDULE)) {
    return AgentOutboundCopy.unverifiedReschedule;
  }
  if (claims.includes(OutboundClaim.PAYMENT_VERIFIED)) {
    return AgentOutboundCopy.unverifiedPayment;
  }
  if (claims.includes(OutboundClaim.DEPOSIT_QR)) {
    return AgentOutboundCopy.unverifiedDepositQr;
  }
  if (
    claims.includes(OutboundClaim.DEPOSIT_RECEIPT_ASSIGNMENT) ||
    claims.includes(OutboundClaim.DEPOSIT_RECEIPT_EXPECTATION)
  ) {
    return AgentOutboundCopy.unverifiedDepositReceipt;
  }
  if (claims.includes(OutboundClaim.HANDOFF)) {
    return AgentOutboundCopy.unverifiedHandoff;
  }
  if (claims.includes(OutboundClaim.CLIENT_NAME)) {
    return AgentOutboundCopy.unverifiedClientName;
  }
  if (claims.includes(OutboundClaim.BRANCH_SELECTION)) {
    return AgentOutboundCopy.unverifiedBranch;
  }
  return AgentOutboundCopy.unverifiedBooking;
}

export function evidenceFromAction(
  action: AgentCommittedAction,
): AgentActionEvidence {
  return {
    operation: action.operation,
    resourceId: action.resourceId,
  };
}

function renderBooking(
  action: AgentCommittedAction,
  depositQrQueued: boolean,
): string {
  const facts = action.facts ?? {};
  const awaitsDeposit = facts.awaitsDeposit === true;
  const header = awaitsDeposit
    ? '¡Listo! Tu reserva quedó hecha; queda pendiente la seña.'
    : '¡Listo! Tu reserva quedó confirmada.';
  const lines = [header, '', ...appointmentBullets(facts)];
  if (facts.mapsUrl) {
    lines.push('', facts.mapsUrl);
  }
  if (awaitsDeposit && depositQrQueued) {
    lines.push(
      '',
      'En el siguiente mensaje te llega el QR para abonar la seña.',
    );
  } else if (awaitsDeposit) {
    lines.push(
      '',
      'El turno queda con la seña pendiente; el equipo te pasa los datos del pago.',
    );
  }
  return lines.join('\n');
}

function renderCancellation(action: AgentCommittedAction): string {
  const facts = action.facts ?? {};
  const when = describeWhen(facts);
  const service = facts.serviceName ? ` de ${facts.serviceName}` : '';
  const lines = [
    when
      ? `Listo. Tu cita${service} del ${when} quedó cancelada.`
      : `Listo. Tu cita${service} quedó cancelada.`,
  ];
  if (facts.depositAtRisk) {
    lines.push(
      '',
      'La cancelación quedó fuera del plazo: la seña puede retenerse; la dueña define.',
    );
  }
  lines.push(
    '',
    'Si en otro momento querés agendar un turno, avisame sin problema.',
  );
  return lines.join('\n');
}

function renderReschedule(action: AgentCommittedAction): string {
  const facts = action.facts ?? {};
  const when = describeWhen(facts);
  const lines = [
    when
      ? `Listo. Tu cita quedó reagendada para el ${when}.`
      : 'Listo. Tu cita quedó reagendada.',
  ];
  if (facts.depositAtRisk) {
    lines.push(
      '',
      'El cambio quedó fuera del plazo: la seña puede retenerse; la dueña define.',
    );
  }
  return lines.join('\n');
}

function appointmentBullets(
  facts: NonNullable<AgentCommittedAction['facts']>,
): string[] {
  const when = describeWhen(facts);
  const attentionParts = [
    facts.serviceName,
    facts.professionalName ? `con ${facts.professionalName}` : null,
    facts.attendeeName ? `a nombre de ${facts.attendeeName}` : null,
  ].filter(Boolean);
  const whereParts = [facts.branchName, facts.branchAddress].filter(Boolean);

  return [
    when ? `- *Cuándo:* ${when}` : null,
    attentionParts.length
      ? `- *Atención:* ${attentionParts.join(' · ')}`
      : null,
    whereParts.length ? `- *Dónde:* ${whereParts.join(' · ')}` : null,
  ].filter((line): line is string => line !== null);
}

function describeWhen(
  facts: NonNullable<AgentCommittedAction['facts']>,
): string | null {
  if (facts.dateLabel && facts.startsAtLabel) {
    return `${facts.dateLabel} · ${facts.startsAtLabel}`;
  }
  if (facts.dateLabel) return facts.dateLabel;
  if (facts.startsAtLabel) return facts.startsAtLabel;
  return null;
}
