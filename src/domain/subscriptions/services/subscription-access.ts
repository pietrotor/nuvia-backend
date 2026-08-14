import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';

import { Subscription } from '../entities/subscription.entity';

export type AgentBlockReason =
  | 'no_subscription'
  | 'expired'
  | 'suspended'
  | 'quota_exhausted';

export interface AgentAccessDecision {
  allowed: boolean;
  reason: AgentBlockReason | null;
  limit: number | null;
  used: number;
}

export function evaluateAgentAccess(input: {
  tenantStatus: TenantStatus;
  subscription: Subscription | null;
  aiRepliesUsed: number;
  now: Date;
}): AgentAccessDecision {
  const used = input.aiRepliesUsed;

  if (input.tenantStatus === TenantStatus.SUSPENDED) {
    return { allowed: false, reason: 'suspended', limit: null, used };
  }

  if (!input.subscription) {
    return { allowed: false, reason: 'no_subscription', limit: null, used };
  }

  if (
    input.subscription.status === 'suspended' ||
    input.subscription.status === 'cancelled'
  ) {
    return { allowed: false, reason: 'suspended', limit: null, used };
  }

  if (!input.subscription.isPeriodActive(input.now)) {
    return { allowed: false, reason: 'expired', limit: null, used };
  }

  const limit = input.subscription.effectiveConfig().quotas.aiRepliesPerPeriod;
  if (limit !== null && used >= limit) {
    return { allowed: false, reason: 'quota_exhausted', limit, used };
  }

  return { allowed: true, reason: null, limit, used };
}
