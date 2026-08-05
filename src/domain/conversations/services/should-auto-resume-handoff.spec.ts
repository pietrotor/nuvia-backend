import { shouldAutoResumeHandoff } from './should-auto-resume-handoff';

describe('shouldAutoResumeHandoff', () => {
  const now = new Date('2026-08-04T15:00:00.000Z');

  it('returns false when the bot is not paused', () => {
    expect(
      shouldAutoResumeHandoff({
        botPaused: false,
        botPausedAt: new Date('2026-08-04T13:00:00.000Z'),
        now,
        handoffAutoResumeMinutes: 60,
      }),
    ).toBe(false);
  });

  it('returns false when auto-resume is disabled (0 minutes)', () => {
    expect(
      shouldAutoResumeHandoff({
        botPaused: true,
        botPausedAt: new Date('2026-08-01T00:00:00.000Z'),
        now,
        handoffAutoResumeMinutes: 0,
      }),
    ).toBe(false);
  });

  it('returns false when the timeout has not elapsed', () => {
    expect(
      shouldAutoResumeHandoff({
        botPaused: true,
        botPausedAt: new Date('2026-08-04T14:30:00.000Z'),
        now,
        handoffAutoResumeMinutes: 60,
      }),
    ).toBe(false);
  });

  it('returns true when the timeout has elapsed', () => {
    expect(
      shouldAutoResumeHandoff({
        botPaused: true,
        botPausedAt: new Date('2026-08-04T13:00:00.000Z'),
        now,
        handoffAutoResumeMinutes: 60,
      }),
    ).toBe(true);
  });

  it('returns true when paused without botPausedAt so old rows are not stuck', () => {
    expect(
      shouldAutoResumeHandoff({
        botPaused: true,
        botPausedAt: null,
        now,
        handoffAutoResumeMinutes: 60,
      }),
    ).toBe(true);
  });
});
