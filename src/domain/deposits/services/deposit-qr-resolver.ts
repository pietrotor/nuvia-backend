import { DepositQr } from '../entities/deposit-qr.entity';

export interface ResolveDepositQrInput {
  // The QR the service (or branch override) points to, when it is charged to a
  // different account.
  serviceDepositQrId: string | null;
  // Prefer a default QR scoped to this branch before a tenant-wide default.
  branchId?: string | null;
  activeDepositQrs: DepositQr[];
}

// Which QR to send for a service that requires a deposit. A business with a single QR
// never has to configure anything: the first one uploaded is already the default, and
// even without a default a lone QR is the only sensible answer.
// Returns null when the business has no QR to charge with; the caller decides what to
// do about it (warn the owner, hand off) instead of picking one at random.
export function resolveDepositQr(
  input: ResolveDepositQrInput,
): DepositQr | null {
  const { serviceDepositQrId, branchId, activeDepositQrs } = input;

  if (serviceDepositQrId) {
    const assigned = activeDepositQrs.find(
      (depositQr) => depositQr.id === serviceDepositQrId,
    );
    // An archived assignment falls back instead of failing: the business still has a
    // way to charge, and the stale pointer is a configuration detail.
    if (assigned) return assigned;
  }

  if (branchId) {
    const branchDefault = activeDepositQrs.find(
      (depositQr) => depositQr.isDefault && depositQr.branchId === branchId,
    );
    if (branchDefault) return branchDefault;
  }

  const tenantDefault = activeDepositQrs.find(
    (depositQr) => depositQr.isDefault && depositQr.branchId === null,
  );
  if (tenantDefault) return tenantDefault;

  // Legacy: a lone default without branch scoping still wins when nothing else matched.
  const anyDefault = activeDepositQrs.find((depositQr) => depositQr.isDefault);
  if (anyDefault) return anyDefault;

  return activeDepositQrs.length === 1 ? activeDepositQrs[0] : null;
}
