import { DateTime } from 'luxon';

// How long the agent takes to read, think and type. Two rules shape every number
// here. It must never answer at a speed no person could type, and it must never
// answer twice at the same speed — including at the edges: a delay that lands on
// the same floor or the same ceiling over and over is as recognisable as no
// delay at all. Waits are drawn log-normal because that is the shape of a human
// reply time (most around a median, the odd one much slower); a flat window
// between two bounds would be its own signature.

export const TYPING_MEDIAN_BASE_MS = 4_000;
export const TYPING_MEDIAN_PER_WORD_MS = 70;
export const TYPING_SPREAD = 0.4;
// The provider splits waits above 20s into chunks; staying below that with the
// closing stretch included keeps one uninterrupted indicator.
export const TYPING_SOFT_MAX_MS = 17_000;
// The last stretch of typing. It is also what is left when the agent already
// took longer than the wait it was aiming for, which is why it is drawn and not
// a constant.
export const TYPING_CLOSING_MEDIAN_MS = 1_100;
export const TYPING_CLOSING_SPREAD = 0.3;
export const TYPING_CLOSING_SOFT_MAX_MS = 3_000;
// What the two ceilings above add up to, and therefore the wait no draw reaches.
export const TYPING_CHUNKING_THRESHOLD_MS = 20_000;

// Short enough that a client who wrote once is not left hanging, long enough to
// catch the second and third message of a burst.
export const DEBOUNCE_FLOOR_MS = 1_500;
export const DEBOUNCE_MEDIAN_MS = 1_500;
export const DEBOUNCE_SPREAD = 0.35;
export const DEBOUNCE_SOFT_MAX_MS = 6_000;

// R4: esthetics centres live around 09:00–21:00 local time. Nuvi still answers
// at night — that is the product — but not at the same pace as at midday.
export const DAY_STARTS_HOUR = 9;
export const DAY_ENDS_HOUR = 21;
export const NIGHT_STARTS_HOUR = 23;
export const NIGHT_ENDS_HOUR = 7;
export const NIGHT_SLOWDOWN = 2.5;

export interface HumanTypingDelayInput {
  text: string;
  // Time the client already spent waiting (the agent thinking, for instance),
  // which counts towards the delay instead of adding to it.
  elapsedMs?: number;
  slowdown?: number;
  random?: () => number;
}

export function humanTypingDelayMs({
  text,
  elapsedMs = 0,
  slowdown = 1,
  random = Math.random,
}: HumanTypingDelayInput): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const median =
    (TYPING_MEDIAN_BASE_MS + words * TYPING_MEDIAN_PER_WORD_MS) * slowdown;
  // The ceiling does not follow the slowdown: a nocturnal answer is slower, not
  // absent, and past twenty seconds the indicator stops being one wait.
  const target = softCap(
    logNormal(median, TYPING_SPREAD, random),
    TYPING_SOFT_MAX_MS,
  );
  const closing = softCap(
    logNormal(TYPING_CLOSING_MEDIAN_MS, TYPING_CLOSING_SPREAD, random),
    TYPING_CLOSING_SOFT_MAX_MS,
  );

  return Math.round(closing + Math.max(0, target - Math.max(0, elapsedMs)));
}

export function replyDebounceMs(random: () => number = Math.random): number {
  return Math.round(
    DEBOUNCE_FLOOR_MS +
      softCap(
        logNormal(DEBOUNCE_MEDIAN_MS, DEBOUNCE_SPREAD, random),
        DEBOUNCE_SOFT_MAX_MS - DEBOUNCE_FLOOR_MS,
      ),
  );
}

// Ramps instead of steps: an answer that suddenly doubles its delay at 21:00
// sharp would be a clock ticking in the data.
export function circadianSlowdown(input: {
  now: Date;
  timezone: string;
}): number {
  const local = DateTime.fromJSDate(input.now, { zone: input.timezone });
  if (!local.isValid) return 1;

  const hour = local.hour + local.minute / 60;
  if (hour >= DAY_STARTS_HOUR && hour < DAY_ENDS_HOUR) return 1;
  if (hour >= NIGHT_STARTS_HOUR || hour < NIGHT_ENDS_HOUR)
    return NIGHT_SLOWDOWN;
  if (hour >= DAY_ENDS_HOUR) {
    return interpolate(
      1,
      NIGHT_SLOWDOWN,
      (hour - DAY_ENDS_HOUR) / (NIGHT_STARTS_HOUR - DAY_ENDS_HOUR),
    );
  }
  return interpolate(
    NIGHT_SLOWDOWN,
    1,
    (hour - NIGHT_ENDS_HOUR) / (DAY_STARTS_HOUR - NIGHT_ENDS_HOUR),
  );
}

function logNormal(
  median: number,
  spread: number,
  random: () => number,
): number {
  return median * Math.exp(spread * standardNormal(random));
}

// Box–Muller. The first draw is kept away from zero, where the logarithm has no
// value to give.
function standardNormal(random: () => number): number {
  const u1 = Math.min(Math.max(random(), 1e-9), 1);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Bends towards the ceiling instead of stopping at it, so no draw ever lands on
// the bound itself.
function softCap(value: number, max: number): number {
  return max * Math.tanh(value / max);
}

function interpolate(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}
