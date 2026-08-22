import {
  assertValidClientReminderPolicy,
  InvalidClientReminderPolicyError,
  mergeClientReminderPolicy,
} from './client-reminder-policy.vo';

describe('client reminder policy', () => {
  it('defaults to the PRD offsets when the row has no policy yet', () => {
    expect(mergeClientReminderPolicy(undefined)).toEqual({
      enabled: true,
      offsets: ['24h', '2h'],
      thankYouAfterVisit: false,
    });
  });

  it('rejects more than three offsets when enabled', () => {
    expect(() =>
      assertValidClientReminderPolicy({
        enabled: true,
        offsets: ['24h', '12h', '2h', '30m'],
        thankYouAfterVisit: false,
      }),
    ).toThrow(InvalidClientReminderPolicyError);
  });

  it('rejects an empty catalog when reminders are on', () => {
    expect(() =>
      assertValidClientReminderPolicy({
        enabled: true,
        offsets: [],
        thankYouAfterVisit: false,
      }),
    ).toThrow(InvalidClientReminderPolicyError);
  });
});
