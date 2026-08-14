export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

export function isOperableSubscriptionStatus(
  status: SubscriptionStatus,
): boolean {
  return (
    status === SubscriptionStatus.TRIALING ||
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.PAST_DUE
  );
}
