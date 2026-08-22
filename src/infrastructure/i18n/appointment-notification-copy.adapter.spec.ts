import { AppointmentNotificationCopyAdapter } from './appointment-notification-copy.adapter';
import { AppointmentNotificationKind } from '@domain/appointment-notifications/value-objects/appointment-notification-kind.vo';
import { NotificationCommandKind } from '@domain/appointment-notifications/value-objects/notification-command.vo';

describe('AppointmentNotificationCopyAdapter', () => {
  const adapter = new AppointmentNotificationCopyAdapter();
  const input = {
    eventId: 'e1',
    kind: AppointmentNotificationKind.BOOKED,
    clientDisplayName: 'María L.',
    serviceName: 'Limpieza',
    professionalName: 'Camila',
    branchName: 'Centro',
    startsAtLabel: 'mar 18 ago, 14:00',
    previousStartsAtLabel: null,
  };

  it('keeps the same opening on retries of the same event', () => {
    const first = adapter.renderAlert(input);
    const second = adapter.renderAlert(input);

    expect(first).toBe(second);
    expect(first).toContain('Aviso automático de Nuvi');
    expect(first).not.toContain('+591');
  });

  it('varies the opening across events and never mentions a phone', () => {
    const other = adapter.renderAlert({ ...input, eventId: 'e-other-event' });
    expect(other.split('\n')[0]).not.toBe(
      adapter.renderAlert(input).split('\n')[0],
    );
    expect(other).not.toContain('59171234567');
  });

  it('answers handshake commands in Spanish without an LLM', () => {
    expect(adapter.handshakeReply(NotificationCommandKind.ACTIVATE)).toMatch(
      /PAUSAR/,
    );
    expect(adapter.handshakeReply(NotificationCommandKind.OPT_OUT)).toMatch(
      /avisos/,
    );
  });
});
