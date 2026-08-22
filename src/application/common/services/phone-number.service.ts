import { Injectable } from '@nestjs/common';
import {
  parsePhoneNumberFromString,
  type CountryCode as LibCountryCode,
} from 'libphonenumber-js';

import {
  InvalidPhoneNumberError,
  PhoneExtensionNotSupportedError,
  UnsupportedCountryCodeError,
} from '@domain/common/exceptions/phone.exceptions';
import {
  assertSupportedCountryCode,
  DEFAULT_COUNTRY_CODE,
  normalizeCountryCode,
} from '@domain/common/value-objects/country-code.vo';
import {
  isSyntacticE164,
  sanitizePhoneInput,
} from '@domain/common/value-objects/e164-phone.vo';

@Injectable()
export class PhoneNumberService {
  normalizeToE164(
    input: string | null | undefined,
    defaultCountry: string = DEFAULT_COUNTRY_CODE,
  ): string | null {
    if (input == null) return null;
    const trimmed = sanitizePhoneInput(input);
    if (!trimmed) return null;

    if (this.hasExtension(trimmed)) {
      throw new PhoneExtensionNotSupportedError();
    }

    const region = normalizeCountryCode(defaultCountry) as LibCountryCode;
    const normalizedInput = this.normalizeInternationalPrefix(trimmed);

    const parsed = parsePhoneNumberFromString(normalizedInput, region);
    if (!parsed?.isValid()) {
      throw new InvalidPhoneNumberError();
    }

    return parsed.format('E.164');
  }

  tryNormalizeToE164(
    input: string | null | undefined,
    defaultCountry: string = DEFAULT_COUNTRY_CODE,
  ): string | null {
    try {
      return this.normalizeToE164(input, defaultCountry);
    } catch {
      return null;
    }
  }

  isValidPhone(
    input: string,
    defaultCountry: string = DEFAULT_COUNTRY_CODE,
  ): boolean {
    return this.tryNormalizeToE164(input, defaultCountry) !== null;
  }

  formatForDisplay(phone: string, businessCountry: string): string {
    const trimmed = sanitizePhoneInput(phone);
    if (!trimmed) return trimmed;

    const region = normalizeCountryCode(businessCountry) as LibCountryCode;
    const parsed = parsePhoneNumberFromString(trimmed);
    if (!parsed?.isValid()) {
      return trimmed;
    }

    if (parsed.country === region) {
      return parsed.formatNational();
    }

    return parsed.formatInternational();
  }

  formatMaskedForDisplay(phoneE164: string, businessCountry: string): string {
    const trimmed = sanitizePhoneInput(phoneE164);
    if (!trimmed) return trimmed;

    const region = normalizeCountryCode(businessCountry) as LibCountryCode;
    const parsed = parsePhoneNumberFromString(trimmed);
    if (!parsed?.isValid()) {
      return this.legacyMasked(trimmed);
    }

    const national = parsed.nationalNumber;
    if (national.length < 4) {
      return this.legacyMasked(trimmed);
    }

    const maskedNational = `${national.slice(0, 2)}****${national.slice(-2)}`;
    if (parsed.country === region) {
      return maskedNational;
    }

    return `+${parsed.countryCallingCode} ${maskedNational}`;
  }

  buildSearchTerms(
    query: string,
    defaultCountry: string = DEFAULT_COUNTRY_CODE,
  ): string[] {
    const trimmed = sanitizePhoneInput(query);
    if (!trimmed) return [];

    const terms = new Set<string>([trimmed]);
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly) {
      terms.add(digitsOnly);
      terms.add(`+${digitsOnly}`);
    }

    const normalized = this.tryNormalizeToE164(trimmed, defaultCountry);
    if (normalized) {
      terms.add(normalized);
      terms.add(normalized.replace(/\D/g, ''));
      const parsed = parsePhoneNumberFromString(normalized);
      if (parsed?.nationalNumber) {
        terms.add(parsed.nationalNumber);
      }
    }

    return [...terms];
  }

  assertCountryCode(value: string): string {
    try {
      return assertSupportedCountryCode(value);
    } catch {
      throw new UnsupportedCountryCodeError();
    }
  }

  private hasExtension(value: string): boolean {
    return /(?:^|\s)(?:ext\.?|x|#)\s*\d+/i.test(value);
  }

  private normalizeInternationalPrefix(value: string): string {
    const trimmed = value.trim();
    if (trimmed.startsWith('00')) {
      return `+${trimmed.slice(2).trim()}`;
    }
    return trimmed;
  }

  private legacyMasked(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 7) return value;
    return `+${digits.slice(0, 4)}****${digits.slice(-3)}`;
  }

  isLegacyAmbiguous(value: string | null | undefined): boolean {
    if (!value) return false;
    const trimmed = sanitizePhoneInput(value);
    if (!trimmed) return false;
    if (isSyntacticE164(trimmed)) return false;
    return true;
  }

  /**
   * Keeps an untouched legacy value during transition; normalizes any edited value.
   */
  resolvePhoneForWrite(
    input: string | null | undefined,
    current: string | null | undefined,
    defaultCountry: string = DEFAULT_COUNTRY_CODE,
  ): string | null | undefined {
    if (input === undefined) return undefined;

    const trimmed = input == null ? null : sanitizePhoneInput(input);
    if (!trimmed) return null;

    const currentTrimmed = current ? sanitizePhoneInput(current) : null;
    if (currentTrimmed && trimmed === currentTrimmed) {
      return currentTrimmed;
    }

    return this.normalizeToE164(trimmed, defaultCountry);
  }
}
