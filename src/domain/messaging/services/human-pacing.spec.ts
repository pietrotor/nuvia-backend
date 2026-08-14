import {
  circadianSlowdown,
  DEBOUNCE_FLOOR_MS,
  DEBOUNCE_SOFT_MAX_MS,
  humanTypingDelayMs,
  NIGHT_SLOWDOWN,
  replyDebounceMs,
  TYPING_CHUNKING_THRESHOLD_MS,
} from './human-pacing';

function sample(draws: number, produce: () => number): number[] {
  return Array.from({ length: draws }, produce);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

describe('humanTypingDelayMs', () => {
  const text = 'Hola, ¿en qué te puedo ayudar?';

  it('takes longer to type a long answer than a short one', () => {
    const half = () => 0.5;

    expect(
      humanTypingDelayMs({ text: 'Sí, claro. '.repeat(40), random: half }),
    ).toBeGreaterThan(humanTypingDelayMs({ text: 'Sí, claro.', random: half }));
  });

  it('spreads with a long tail rather than filling a flat window', () => {
    const delays = sample(3_000, () => humanTypingDelayMs({ text }));

    // The signature of a human reply time: a few much slower answers pull the
    // average past the middle. A uniform draw would sit on top of it.
    expect(mean(delays)).toBeGreaterThan(median(delays));
  });

  it('never repeats itself, at either end of the range', () => {
    const normal = sample(50, () => humanTypingDelayMs({ text }));
    // The agent took far longer than any delay it would have aimed for, which
    // is the case that used to collapse onto a fixed floor.
    const overrun = sample(50, () =>
      humanTypingDelayMs({ text, elapsedMs: 60_000 }),
    );

    expect(new Set(normal).size).toBeGreaterThan(40);
    expect(new Set(overrun).size).toBeGreaterThan(40);
    expect(Math.min(...overrun)).toBeGreaterThan(0);
  });

  it('stays under the wait the provider would split in chunks', () => {
    const delays = sample(3_000, () =>
      humanTypingDelayMs({
        text: 'palabra '.repeat(300),
        slowdown: NIGHT_SLOWDOWN,
      }),
    );

    expect(Math.max(...delays)).toBeLessThan(TYPING_CHUNKING_THRESHOLD_MS);
  });

  it('discounts the time the client already spent waiting', () => {
    const half = () => 0.5;

    expect(humanTypingDelayMs({ text, elapsedMs: 2_000, random: half })).toBe(
      humanTypingDelayMs({ text, random: half }) - 2_000,
    );
  });

  it('answers slower when the business is asleep', () => {
    const day = median(sample(500, () => humanTypingDelayMs({ text })));
    const night = median(
      sample(500, () => humanTypingDelayMs({ text, slowdown: NIGHT_SLOWDOWN })),
    );

    expect(night).toBeGreaterThan(day);
  });
});

describe('replyDebounceMs', () => {
  it('waits long enough to catch a burst without ever waiting the same', () => {
    const waits = sample(200, () => replyDebounceMs());

    expect(Math.min(...waits)).toBeGreaterThan(DEBOUNCE_FLOOR_MS);
    expect(Math.max(...waits)).toBeLessThan(DEBOUNCE_SOFT_MAX_MS);
    expect(new Set(waits).size).toBeGreaterThan(150);
  });
});

describe('circadianSlowdown', () => {
  const timezone = 'America/La_Paz';
  const atLaPaz = (hour: number, minute = 0) =>
    new Date(
      Date.UTC(2026, 7, 4, hour + 4, minute), // La Paz is UTC-4 all year.
    );

  it('runs at full speed during the hours the centre is open', () => {
    expect(circadianSlowdown({ now: atLaPaz(10), timezone })).toBe(1);
    expect(circadianSlowdown({ now: atLaPaz(20, 59), timezone })).toBe(1);
  });

  it('drags at dawn, when nobody is behind the phone', () => {
    expect(circadianSlowdown({ now: atLaPaz(3), timezone })).toBe(
      NIGHT_SLOWDOWN,
    );
  });

  it('slides between the two instead of switching on the hour', () => {
    const evening = circadianSlowdown({ now: atLaPaz(22), timezone });

    expect(evening).toBeGreaterThan(1);
    expect(evening).toBeLessThan(NIGHT_SLOWDOWN);
    expect(
      circadianSlowdown({ now: atLaPaz(22, 30), timezone }),
    ).toBeGreaterThan(evening);
  });

  it('reads the clock of the business, not of the server', () => {
    const noonInLaPaz = atLaPaz(12);

    expect(circadianSlowdown({ now: noonInLaPaz, timezone })).toBe(1);
    expect(
      circadianSlowdown({ now: noonInLaPaz, timezone: 'Asia/Tokyo' }),
    ).toBe(NIGHT_SLOWDOWN);
  });

  it('falls back to full speed when the timezone makes no sense', () => {
    expect(
      circadianSlowdown({ now: atLaPaz(3), timezone: 'Mars/Olympus' }),
    ).toBe(1);
  });
});
