import { pgEnum } from 'drizzle-orm/pg-core';

// Curated list: a currency exists here only if `Currency` in the domain also knows
// the symbol people use for it.
export const currencyEnum = pgEnum('currency', ['BOB', 'USD']);
