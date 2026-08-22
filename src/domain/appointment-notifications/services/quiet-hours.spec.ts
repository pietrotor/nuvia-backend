import {
  isEmergencyWindow,
  isQuietHour,
  nextQuietResumeAt,
} from './quiet-hours';

describe('quiet hours', () => {
  const timezone = 'America/La_Paz';

  it('treats 21:00 local as quiet and 08:00 as the resume window', () => {
    expect(isQuietHour(new Date('2026-08-18T01:00:00.000Z'), timezone)).toBe(
      true,
    );
    expect(isQuietHour(new Date('2026-08-18T12:00:00.000Z'), timezone)).toBe(
      false,
    );
  });

  it('resumes after 08:00 local with jitter into the morning', () => {
    const resume = nextQuietResumeAt(
      new Date('2026-08-18T02:00:00.000Z'),
      timezone,
    );
    const hour = resume.toISOString();
    expect(hour >= '2026-08-18T12:15:00.000Z').toBe(true);
    expect(hour < '2026-08-18T12:25:00.000Z').toBe(true);
  });

  it('flags a cancellation inside 12 hours as an emergency for the assigned professional', () => {
    const now = new Date('2026-08-18T12:00:00.000Z');
    expect(isEmergencyWindow(new Date('2026-08-18T20:00:00.000Z'), now)).toBe(
      true,
    );
    expect(isEmergencyWindow(new Date('2026-08-19T12:01:00.000Z'), now)).toBe(
      false,
    );
  });
});
