import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import {
  Service,
  ServiceProps,
} from '@domain/services/entities/service.entity';
import { calculateDepositAmount } from './deposit-amount';

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
    depositPercent: null,
    depositQrId: null,
    clientChoosesProfessional: true,
    isActive: true,
    professionalIds: [],
    ...overrides,
  });

describe('calculateDepositAmount', () => {
  it('charges nothing when the service requires no deposit', () => {
    expect(
      calculateDepositAmount(
        service({ requiresDeposit: false, depositAmount: null }),
      ),
    ).toBeNull();
  });

  it('uses the fixed amount as configured', () => {
    const amount = calculateDepositAmount(service({ depositAmount: '50.00' }));

    expect(amount?.amount).toBe('50.00');
    expect(amount?.currency).toBe(Currency.BOB);
  });

  it('turns a percentage into an amount in the service currency', () => {
    const amount = calculateDepositAmount(service({ depositPercent: 30 }));

    expect(amount?.amount).toBe('75.00');
    expect(amount?.display()).toBe('Bs 75');
  });

  it('applies the percent to an effective price when one is provided', () => {
    const amount = calculateDepositAmount(service({ depositPercent: 30 }), {
      price: Money.of('200.00', Currency.BOB),
    });

    expect(amount?.amount).toBe('60.00');
  });

  it('rounds half a cent up so the client transfers a payable amount', () => {
    const amount = calculateDepositAmount(
      service({ price: '250.55', depositPercent: 30 }),
    );

    expect(amount?.amount).toBe('75.17');
  });

  it('keeps the cents of a percentage that does not divide evenly', () => {
    const amount = calculateDepositAmount(
      service({ price: '99.90', depositPercent: 33 }),
    );

    expect(amount?.amount).toBe('32.97');
  });

  it('charges nothing when a deposit is required but nothing says how much', () => {
    expect(calculateDepositAmount(service())).toBeNull();
  });
});
