import { AppointmentViewRepository } from '@domain/appointments/repositories/appointment-view.repository';
import { ValidationError } from '@domain/common/exceptions';
import { ClockPort } from '@domain/common/ports/clock.port';
import { ScheduleContextResolver } from '../services/schedule-context-resolver.service';
import { ListAppointmentsUseCase } from './list-appointments.use-case';

describe('ListAppointmentsUseCase', () => {
  let appointmentViewRepository: jest.Mocked<
    Pick<AppointmentViewRepository, 'findInRange'>
  >;
  let useCase: ListAppointmentsUseCase;

  beforeEach(() => {
    appointmentViewRepository = {
      findInRange: jest.fn().mockResolvedValue([]),
    };
    const scheduleContext: jest.Mocked<
      Pick<ScheduleContextResolver, 'tenantTimezone'>
    > = {
      tenantTimezone: jest.fn().mockResolvedValue('America/La_Paz'),
    };
    // 22:00 on August 2 in La Paz, already August 3 in UTC.
    const clock: ClockPort = {
      now: () => new Date('2026-08-03T02:00:00.000Z'),
    };

    useCase = new ListAppointmentsUseCase(
      appointmentViewRepository as unknown as AppointmentViewRepository,
      scheduleContext as unknown as ScheduleContextResolver,
      clock,
    );
  });

  it('with no dates returns the business day, not the UTC one', async () => {
    await useCase.execute({});

    expect(appointmentViewRepository.findInRange).toHaveBeenCalledWith({
      from: new Date('2026-08-02T04:00:00.000Z'),
      toExclusive: new Date('2026-08-03T04:00:00.000Z'),
      professionalId: undefined,
    });
  });

  it('takes the whole range, with the last day included', async () => {
    await useCase.execute({ from: '2026-08-10', to: '2026-08-12' });

    expect(appointmentViewRepository.findInRange).toHaveBeenCalledWith({
      from: new Date('2026-08-10T04:00:00.000Z'),
      toExclusive: new Date('2026-08-13T04:00:00.000Z'),
      professionalId: undefined,
    });
  });

  it('filters by professional for a single-professional agenda', async () => {
    await useCase.execute({ professionalId: 'p1' });

    expect(appointmentViewRepository.findInRange).toHaveBeenCalledWith(
      expect.objectContaining({ professionalId: 'p1' }),
    );
  });

  it('rejects an inverted range', async () => {
    await expect(
      useCase.execute({ from: '2026-08-12', to: '2026-08-10' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(appointmentViewRepository.findInRange).not.toHaveBeenCalled();
  });
});
