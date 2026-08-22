/** Syntactic E.164: leading +, country code cannot start with 0, 8–15 digits total. */
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function isSyntacticE164(value: string): boolean {
  return E164_PATTERN.test(value);
}

export function sanitizePhoneInput(value: string): string {
  return value.trim();
}
