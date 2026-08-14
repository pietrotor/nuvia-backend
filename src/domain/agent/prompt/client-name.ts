// The name we store comes from the WhatsApp profile, so it can be anything: a full name,
// a nickname wrapped in emoji, or the "Cliente 1234" the webhook falls back to when the
// profile has none. Greeting someone by any of those reads worse than using no name, so
// this returns the first thing that actually looks like a first name, or nothing.
const PLACEHOLDER_NAME = /^cliente\b/i;
const NOT_NAME_CHARS = /[^\p{L}\p{M}'’-]/gu;
const MIN_LENGTH = 2;
const MAX_LENGTH = 20;

export function promptClientName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed || PLACEHOLDER_NAME.test(trimmed)) return '';

  const first = trimmed
    .split(/\s+/)
    .map((token) => token.replace(NOT_NAME_CHARS, ''))
    .find((token) => token.length >= MIN_LENGTH);

  return first && first.length <= MAX_LENGTH ? first : '';
}
