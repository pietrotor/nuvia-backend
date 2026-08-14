// The agent may only name clock times a tool actually returned. Left alone the model reads
// a free window like "09:00 a 18:00" as a list and writes it out quarter by quarter: that
// is how a client was offered 17:45 for a treatment that has to be finished by 18:00.

const CLOCK_TIME = /(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g;

// Every distinct clock time the text names, as HH:mm.
export function clockTimes(text: string): string[] {
  const found = new Set<string>();

  for (const match of text.matchAll(CLOCK_TIME)) {
    found.add(`${match[1].padStart(2, '0')}:${match[2]}`);
  }

  return [...found];
}

// The times the answer names that no tool put on the table. An empty `offerable` means no
// tool spoke about the schedule this turn, so there is nothing to check the answer against
// and the guard stays out of the way.
export function unofferedTimes(
  text: string,
  offerable: readonly string[],
): string[] {
  if (offerable.length === 0) return [];

  const allowed = new Set(offerable.flatMap(clockTimes));
  if (allowed.size === 0) return [];

  return clockTimes(text).filter((time) => !allowed.has(time));
}
