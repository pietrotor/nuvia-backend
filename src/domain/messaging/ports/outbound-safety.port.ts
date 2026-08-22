export interface OutboundSafetySnapshot {
  breakerOpen: boolean;
  internalBudgetDegraded: boolean;
}

export interface OutboundSafetyPort {
  snapshot(tenantId: string): Promise<OutboundSafetySnapshot>;
  openBreaker(tenantId: string): Promise<void>;
}

export const OUTBOUND_SAFETY_PORT = 'OutboundSafetyPort';
