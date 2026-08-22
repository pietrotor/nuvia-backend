import { describe, expect, it } from '@jest/globals';

import { PhoneNumberService } from './phone-number.service';

describe('PhoneNumberService', () => {
  const service = new PhoneNumberService();

  it('normalizes a Bolivian national number', () => {
    expect(service.normalizeToE164('71234567', 'BO')).toBe('+59171234567');
  });

  it('formats a national display for same country', () => {
    expect(service.formatForDisplay('+59171234567', 'BO')).toBe('71234567');
  });

  it('formats international display for foreign numbers', () => {
    expect(service.formatForDisplay('+14155552671', 'BO')).toContain('+1');
  });

  it('masks a national number for same-country display', () => {
    expect(service.formatMaskedForDisplay('+59171234567', 'BO')).toBe(
      '71****67',
    );
  });

  it('masks an international number with calling code', () => {
    expect(service.formatMaskedForDisplay('+14155552671', 'BO')).toBe(
      '+1 41****71',
    );
  });

  it('builds search terms for national and E.164 queries', () => {
    const terms = service.buildSearchTerms('71234567', 'BO');
    expect(terms).toContain('71234567');
    expect(terms).toContain('+59171234567');
  });
});
