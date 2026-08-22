import {
  getCountries,
  type CountryCode as LibCountryCode,
} from 'libphonenumber-js';

export const DEFAULT_COUNTRY_CODE = 'BO';

const SUPPORTED_COUNTRY_CODES = new Set<string>(getCountries());

export type CountryCode = string;

export function normalizeCountryCode(value: string): CountryCode {
  return value.trim().toUpperCase();
}

export function isSupportedCountryCode(value: string): value is CountryCode {
  return SUPPORTED_COUNTRY_CODES.has(normalizeCountryCode(value));
}

export function assertSupportedCountryCode(value: string): CountryCode {
  const normalized = normalizeCountryCode(value);
  if (!isSupportedCountryCode(normalized)) {
    throw new Error(`Unsupported country code: ${value}`);
  }
  return normalized as LibCountryCode;
}
