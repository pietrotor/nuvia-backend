import {
  hasConfirmedClientName,
  normalizeConfirmedClientName,
} from './confirmed-client-name';

describe('confirmed client name', () => {
  it('accepts a real name the client typed', () => {
    expect(normalizeConfirmedClientName('  María López  ')).toBe('María López');
    expect(hasConfirmedClientName('Ana')).toBe(true);
  });

  it('rejects the WhatsApp placeholder and a profile that is really a phone', () => {
    expect(normalizeConfirmedClientName('Cliente 1998')).toBeNull();
    expect(normalizeConfirmedClientName('+591 69531998')).toBeNull();
    expect(hasConfirmedClientName('Cliente 1234')).toBe(false);
  });

  it('rejects missing, short, or letter-less values', () => {
    expect(normalizeConfirmedClientName(null)).toBeNull();
    expect(normalizeConfirmedClientName('A')).toBeNull();
    expect(normalizeConfirmedClientName('🌸🌸')).toBeNull();
  });
});
