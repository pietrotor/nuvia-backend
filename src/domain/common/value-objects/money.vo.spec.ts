import { ValidationError } from '../exceptions';
import { Currency } from './currency.vo';
import { Money } from './money.vo';

describe('Money', () => {
  it('displays the symbol people use, not the currency code', () => {
    expect(Money.of('150.00', Currency.BOB).display()).toBe('Bs 150');
    expect(Money.of('39.90', Currency.USD).display()).toBe('$ 39.90');
  });

  it('keeps cents that are not zero', () => {
    expect(Money.of('150.50', Currency.BOB).display()).toBe('Bs 150.50');
  });

  it('rejects an amount that is not a positive number with two decimals', () => {
    expect(() => Money.of('-10.00', Currency.BOB)).toThrow(ValidationError);
    expect(() => Money.of('10.005', Currency.BOB)).toThrow(ValidationError);
    expect(() => Money.of('', Currency.BOB)).toThrow(ValidationError);
  });
});
