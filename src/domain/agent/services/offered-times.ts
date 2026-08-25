// The agent may only name clock times a tool actually returned. Left alone the model reads
// a free window like "09:00 a 18:00" as a list and writes it out quarter by quarter: that
// is how a client was offered 17:45 for a treatment that has to be finished by 18:00.

const CLOCK_TIME = /(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g;

export interface OfferedTimesOptions {
  // When true, an empty offerable list means "no exact times are allowed" (day/period
  // choice). When false, an empty list means no schedule tool spoke this turn, so the
  // guard stays out of the way.
  forbidUnlisted?: boolean;
}

// Every distinct clock time the text names, as HH:mm.
export function clockTimes(text: string): string[] {
  const found = new Set<string>();

  for (const match of text.matchAll(CLOCK_TIME)) {
    found.add(`${match[1].padStart(2, '0')}:${match[2]}`);
  }

  return [...found];
}

// The times the answer names that no tool put on the table.
export function unofferedTimes(
  text: string,
  offerable: readonly string[],
  options: OfferedTimesOptions = {},
): string[] {
  const forbidUnlisted = options.forbidUnlisted === true;
  if (!forbidUnlisted && offerable.length === 0) return [];

  const allowed = new Set(offerable.flatMap(clockTimes));
  if (!forbidUnlisted && allowed.size === 0) return [];

  return clockTimes(text).filter((time) => !allowed.has(time));
}
