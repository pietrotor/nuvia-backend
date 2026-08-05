import { ErrorCode, ValidationError } from '../exceptions';
import { Currency, currencySymbol } from './currency.vo';

const AMOUNT_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/;

// An amount without its currency is meaningless once the business can charge in
// something other than Bs. The amount is numeric(12,2) in Postgres, so it travels as
// a string: a float would lose cents.
export class Money {
  private constructor(
    public readonly amount: string,
    public readonly currency: Currency,
  ) {}

  static of(amount: string, currency: Currency): Money {
    if (!AMOUNT_PATTERN.test(amount)) {
      throw new ValidationError(ErrorCode.INVALID_AMOUNT);
    }

    return new Money(amount, currency);
  }

  // What a person reads, in the business currency: "Bs 150", "$ 39.90". Cents that
  // are zero only add noise.
  display(): string {
    return `${currencySymbol(this.currency)} ${this.amount.replace(/\.00$/, '')}`;
  }
}
