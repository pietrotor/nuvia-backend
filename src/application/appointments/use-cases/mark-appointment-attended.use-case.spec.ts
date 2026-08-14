import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import {
  AppointmentNotFoundError,
  InvalidAppointmentTransitionError,
} from '@domain/appointments/exceptions/appointment.exceptions';
import { AppointmentRepository } from '@domain/appointments/repositories/appointment.repository';
import { MarkAppointmentAttendedUseCase } from './mark-appointment-attended.use-case';

const appointment = (status: AppointmentStatus): Appointment =>
  new Appointment({
    id: 'a1',
    tenantId: 't1',
    branchId: 'b1',
    clientId: 'c1',
    professionalId: 'p1',
    serviceId: 's1',
    startsAt: new Date('2026-08-03T15:00:00.000Z'),
    endsAt: new Date('2026-08-03T16:00:00.000Z'),
    status,
    price: Money.of('150.00', Currency.BOB),
  });

describe('MarkAppointmentAttendedUseCase', () => {
  let appointmentRepository: jest.Mocked<
    Pick<AppointmentRepository, 'findById' | 'save'>
  >;
  let useCase: MarkAppointmentAttendedUseCase;

  beforeEach(() => {
    appointmentRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(appointment(AppointmentStatus.CONFIRMED)),
      save: jest.fn((attended: Appointment) => Promise.resolve(attended)),
    };
    useCase = new MarkAppointmentAttendedUseCase(
      appointmentRepository as unknown as AppointmentRepository,
      { record: jest.fn() } as unknown as AuditRecorder,
      { changed: jest.fn() } as unknown as AgendaEventPublisher,
    );
  });

  it('marks a confirmed appointment as attended', async () => {
    const result = await useCase.execute('a1');

    expect(result.status).toBe(AppointmentStatus.ATTENDED);
  });

  it('does not mark as attended an appointment whose deposit is unverified', async () => {
    appointmentRepository.findById.mockResolvedValue(
      appointment(AppointmentStatus.PENDING_DEPOSIT),
    );

    await expect(useCase.execute('a1')).rejects.toBeInstanceOf(
      InvalidAppointmentTransitionError,
    );
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it('fails when the appointment does not exist in the tenant', async () => {
    appointmentRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('a1')).rejects.toBeInstanceOf(
      AppointmentNotFoundError,
    );
  });
});
