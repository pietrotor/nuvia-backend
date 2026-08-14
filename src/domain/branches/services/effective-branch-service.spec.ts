import { Currency } from '@domain/common/value-objects/currency.vo';
import {
  Service,
  ServiceProps,
} from '@domain/services/entities/service.entity';

import { BranchService } from '../entities/branch-service.entity';
import { resolveEffectiveBranchService } from './effective-branch-service';

const service = (overrides: Partial<ServiceProps> = {}): Service =>
  new Service({
    id: 's1',
    tenantId: 't1',
    name: 'Hidrafacial',
    durationMinutes: 60,
    currency: Currency.BOB,
    price: '250.00',
    requiresDeposit: true,
    depositAmount: null,
    depositPercent: 30,
    depositQrId: 'qr-catalog',
    clientChoosesProfessional: true,
    isActive: true,
    professionalIds: [],
    ...overrides,
  });

const branchService = (
  overrides: Partial<ConstructorParameters<typeof BranchService>[0]> = {},
): BranchService =>
  new BranchService({
    tenantId: 't1',
    branchId: 'b1',
    serviceId: 's1',
    priceOverrideAmount: null,
    depositAmountOverrideAmount: null,
    depositQrId: null,
    isActive: true,
    ...overrides,
  });

describe('resolveEffectiveBranchService', () => {
  it('keeps catalog price and percent deposit when there is no override', () => {
    const effective = resolveEffectiveBranchService(service(), branchService());

    expect(effective.price.amount).toBe('250.00');
    expect(effective.depositAmount?.amount).toBe('75.00');
    expect(effective.depositQrId).toBe('qr-catalog');
  });

  it('recalculates a percent deposit against a price override', () => {
    const effective = resolveEffectiveBranchService(
      service(),
      branchService({ priceOverrideAmount: '200.00' }),
    );

    expect(effective.price.amount).toBe('200.00');
    expect(effective.depositAmount?.amount).toBe('60.00');
  });

  it('uses a fixed deposit override without touching the price', () => {
    const effective = resolveEffectiveBranchService(
      service(),
      branchService({ depositAmountOverrideAmount: '40.00' }),
    );

    expect(effective.price.amount).toBe('250.00');
    expect(effective.depositAmount?.amount).toBe('40.00');
  });

  it('prefers the branch QR when one is set', () => {
    const effective = resolveEffectiveBranchService(
      service(),
      branchService({ depositQrId: 'qr-branch' }),
    );

    expect(effective.depositQrId).toBe('qr-branch');
  });
});
