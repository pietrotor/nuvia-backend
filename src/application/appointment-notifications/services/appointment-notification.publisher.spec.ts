import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotificationEventRepository } from '@domain/appointment-notifications/repositories/appointment-notification-event.repository';
import { AppointmentNotificationKind } from '@domain/appointment-notifications/value-objects/appointment-notification-kind.vo';
import { NOTIFICATION_COALESCE_DELAY_MS } from '@domain/appointment-notifications/services/notification-limits';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { ClockPort } from '@domain/common/ports/clock.port';
import { AppointmentNotificationPublisher } from './appointment-notification.publisher';

const now = new Date('2026-08-18T12:00:00.000Z');

const appointment = new Appointment({
  id: 'a1',
  tenantId: 't1',
  branchId: 'b1',
  clientId: 'c1',
  professionalId: 'p1',
  serviceId: 's1',
  startsAt: new Date('2026-08-18T18:00:00.000Z'),
  endsAt: new Date('2026-08-18T19:00:00.000Z'),
  status: AppointmentStatus.CONFIRMED,
  price: Money.of('150.00', Currency.BOB),
});

describe('AppointmentNotificationPublisher', () => {
  it('persists a booked event with a coalesce delay and no broker call', async () => {
    const events: jest.Mocked<
      Pick<AppointmentNotificationEventRepository, 'create'>
    > = {
      create: jest.fn().mockResolvedValue({}),
    };
    const clock: ClockPort = { now: () => now };
    const publisher = new AppointmentNotificationPublisher(
      events as unknown as AppointmentNotificationEventRepository,
      clock,
    );

    await publisher.recordBooked(appointment);

    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 'a1',
        kind: AppointmentNotificationKind.BOOKED,
        previous: null,
        nextAttemptAt: new Date(now.getTime() + NOTIFICATION_COALESCE_DELAY_MS),
      }),
    );
  });
});
