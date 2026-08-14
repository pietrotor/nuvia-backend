import { Money } from '@domain/common/value-objects/money.vo';
import { Service } from '@domain/services/entities/service.entity';

// A percentage is useless to someone about to type an amount into her banking app, so
// it becomes a concrete amount in one place instead of in every message the agent
// writes. Null when the service charges no deposit.
// Optional `price` is the branch-effective price: percent deposits must follow it.
export function calculateDepositAmount(
  service: Service,
  options?: { price?: Money },
): Money | null {
  if (!service.requiresDeposit) return null;
  if (service.depositAmount) return service.depositAmount;
  if (service.depositPercent === null) return null;

  const price = options?.price ?? service.price;

  return Money.of(
    fromCents(percentOfCents(toCents(price.amount), service.depositPercent)),
    price.currency,
  );
}

const toCents = (amount: string): number => {
  const [whole, fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

// Half up on the cent, in integer arithmetic: 30% of Bs 250.55 is 75.165, and the
// client transfers Bs 75.17 rather than whatever a float happens to round to.
// `deposit_percent` is an integer between 1 and 100, so `cents * percent` stays exact.
const percentOfCents = (cents: number, percent: number): number => {
  const hundredthsOfCent = cents * percent;
  return (
    Math.trunc(hundredthsOfCent / 100) + (hundredthsOfCent % 100 >= 50 ? 1 : 0)
  );
};

const fromCents = (cents: number): string =>
  `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
