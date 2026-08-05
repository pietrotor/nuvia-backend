export enum Currency {
  BOB = 'BOB',
  USD = 'USD',
}

// The code identifies the currency; the symbol is what a person reads. Nobody in
// Bolivia says "BOB", they say "Bs". Supporting a new currency means adding its
// symbol here and extending the `currency` pg enum with a migration.
const SYMBOLS: Record<Currency, string> = {
  [Currency.BOB]: 'Bs',
  [Currency.USD]: '$',
};

export function currencySymbol(currency: Currency): string {
  return SYMBOLS[currency];
}
