const PLACEHOLDER_NAME = /^cliente\b/i;
const PHONE_LIKE = /\d{6,}/;
const LETTERS = /\p{L}/gu;
const MIN_LENGTH = 2;
const MAX_LENGTH = 255;

export function normalizeConfirmedClientName(
  raw: string | null | undefined,
): string | null {
  const trimmed = raw?.trim().replace(/\s+/g, ' ') ?? '';
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return null;
  if (PLACEHOLDER_NAME.test(trimmed)) return null;
  if (PHONE_LIKE.test(trimmed)) return null;

  const letters = trimmed.match(LETTERS)?.join('') ?? '';
  if (letters.length < MIN_LENGTH) return null;

  return trimmed;
}

export function hasConfirmedClientName(
  name: string | null | undefined,
): boolean {
  return normalizeConfirmedClientName(name) !== null;
}
