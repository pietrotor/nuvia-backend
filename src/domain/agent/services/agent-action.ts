// Resource-bound proof that a mutable tool actually committed something. Tool names alone
// are too coarse: a successful list_services must never authorize "ya cancelé tu cita".

export type AgentActionOperation =
  | 'appointment.book'
  | 'appointment.reschedule'
  | 'appointment.cancel'
  | 'deposit.qr_queued'
  | 'deposit.qr_sent'
  | 'deposit.receipt_assigned'
  | 'deposit.receipt_expected'
  | 'conversation.handoff'
  | 'client.name_confirmed'
  | 'conversation.branch_set';

export type AgentActionResourceType =
  | 'appointment'
  | 'client'
  | 'branch'
  | 'conversation'
  | 'deposit_receipt'
  | 'deposit_qr';

// queued = follow-up scheduled but not yet sent (deposit QR after booking).
// accepted = provider accepted an outbound (resend QR).
// committed = domain state changed in our database.
export type AgentActionOutcome = 'committed' | 'queued' | 'accepted';

export interface AgentActionFacts {
  status?: string;
  startsAtLabel?: string;
  dateLabel?: string;
  serviceName?: string;
  professionalName?: string;
  attendeeName?: string | null;
  branchName?: string;
  branchAddress?: string | null;
  mapsUrl?: string | null;
  depositAtRisk?: boolean;
  awaitsDeposit?: boolean;
  clientName?: string;
}

export interface AgentCommittedAction {
  operation: AgentActionOperation;
  resourceType: AgentActionResourceType;
  resourceId: string;
  outcome: AgentActionOutcome;
  facts?: AgentActionFacts;
}

export interface AgentActionEvidence {
  operation: AgentActionOperation;
  resourceId?: string;
}
