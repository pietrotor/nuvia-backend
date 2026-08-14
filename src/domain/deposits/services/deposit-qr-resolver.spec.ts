import { DepositQr } from '../entities/deposit-qr.entity';
import { resolveDepositQr } from './deposit-qr-resolver';

const depositQr = (
  id: string,
  overrides: Partial<{
    isDefault: boolean;
    isActive: boolean;
    branchId: string | null;
  }> = {},
): DepositQr =>
  new DepositQr({
    id,
    tenantId: 't1',
    branchId: overrides.branchId ?? null,
    label: `QR ${id}`,
    storageKey: `tenants/t1/deposit-qrs/${id}.png`,
    mimeType: 'image/png',
    sizeBytes: 1024,
    isDefault: overrides.isDefault ?? false,
    isActive: overrides.isActive ?? true,
  });

describe('resolveDepositQr', () => {
  it('uses the QR the service points to', () => {
    const own = depositQr('own');
    const resolved = resolveDepositQr({
      serviceDepositQrId: 'own',
      branchId: 'b1',
      activeDepositQrs: [depositQr('main', { isDefault: true }), own],
    });

    expect(resolved).toBe(own);
  });

  it('falls back to the default when the assigned QR was archived', () => {
    const main = depositQr('main', { isDefault: true });
    const resolved = resolveDepositQr({
      serviceDepositQrId: 'archived',
      activeDepositQrs: [main],
    });

    expect(resolved).toBe(main);
  });

  it('prefers the branch default over a tenant-wide default', () => {
    const branchDefault = depositQr('branch', {
      isDefault: true,
      branchId: 'b1',
    });
    const tenantDefault = depositQr('tenant', {
      isDefault: true,
      branchId: null,
    });
    const resolved = resolveDepositQr({
      serviceDepositQrId: null,
      branchId: 'b1',
      activeDepositQrs: [tenantDefault, branchDefault],
    });

    expect(resolved).toBe(branchDefault);
  });

  it('uses the tenant-wide default when the branch has none', () => {
    const tenantDefault = depositQr('tenant', {
      isDefault: true,
      branchId: null,
    });
    const resolved = resolveDepositQr({
      serviceDepositQrId: null,
      branchId: 'b1',
      activeDepositQrs: [
        depositQr('other-branch', { isDefault: true, branchId: 'b2' }),
        tenantDefault,
      ],
    });

    expect(resolved).toBe(tenantDefault);
  });

  it('uses the default when the service points at no QR', () => {
    const main = depositQr('main', { isDefault: true });
    const resolved = resolveDepositQr({
      serviceDepositQrId: null,
      activeDepositQrs: [depositQr('other'), main],
    });

    expect(resolved).toBe(main);
  });

  it('uses the only active QR when none is marked as default', () => {
    const only = depositQr('only');
    const resolved = resolveDepositQr({
      serviceDepositQrId: null,
      activeDepositQrs: [only],
    });

    expect(resolved).toBe(only);
  });

  it('picks none when there is no default and more than one QR', () => {
    const resolved = resolveDepositQr({
      serviceDepositQrId: null,
      activeDepositQrs: [depositQr('a'), depositQr('b')],
    });

    expect(resolved).toBeNull();
  });

  it('picks none when the business has no active QR', () => {
    const resolved = resolveDepositQr({
      serviceDepositQrId: 'archived',
      activeDepositQrs: [],
    });

    expect(resolved).toBeNull();
  });
});
