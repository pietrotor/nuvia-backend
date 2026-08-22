import { NotificationContact } from './notification-contact.entity';
import { NotificationContactStatus } from '../value-objects/notification-contact-status.vo';

const pending = () =>
  new NotificationContact({
    id: 'c1',
    tenantId: 't1',
    displayName: 'Camila',
    phoneE164: '+59171234567',
    status: NotificationContactStatus.PENDING,
    activationCodeHash: 'hash',
    activationExpiresAt: new Date('2026-08-25T00:00:00.000Z'),
    activationProviderMessageId: null,
    activatedAt: null,
    pausedAt: null,
    deactivatedAt: null,
    lastInboundAt: null,
  });

describe('NotificationContact', () => {
  it('activates from pending and then can receive alerts', () => {
    const active = pending().activate({
      now: new Date('2026-08-18T12:00:00.000Z'),
      providerMessageId: 'wamid.1',
    });

    expect(active.status).toBe(NotificationContactStatus.ACTIVE);
    expect(active.canReceiveAlerts()).toBe(true);
    expect(active.activationCodeHash).toBeNull();
  });

  it('does not mutate an already activated phone on pause/resume/deactivate', () => {
    const now = new Date('2026-08-18T12:00:00.000Z');
    const active = pending().activate({ now, providerMessageId: 'wamid.1' });
    const paused = active.pause(now);
    const resumed = paused.resume(now);
    const deactivated = resumed.deactivate(now);

    expect(paused.status).toBe(NotificationContactStatus.PAUSED);
    expect(paused.canReceiveAlerts()).toBe(false);
    expect(resumed.status).toBe(NotificationContactStatus.ACTIVE);
    expect(deactivated.status).toBe(NotificationContactStatus.DEACTIVATED);
    expect(deactivated.phoneE164).toBe(active.phoneE164);
  });

  it('masks the phone for panel display', () => {
    expect(pending().maskedPhone()).toBe('+5917****567');
  });
});
