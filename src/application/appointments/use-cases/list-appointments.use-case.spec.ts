import { AppointmentViewRepository } from '@domain/appointments/repositories/appointment-view.repository';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import { ValidationError } from '@domain/common/exceptions';
import { ClockPort } from '@domain/common/ports/clock.port';
import { AccessibleBranchesResolver } from '@application/branches/services/accessible-branches.resolver';
import { ScheduleContextResolver } from '../services/schedule-context-resolver.service';
import { ListAppointmentsUseCase } from './list-appointments.use-case';

describe('ListAppointmentsUseCase', () => {
  let appointmentViewRepository: jest.Mocked<
    Pick<AppointmentViewRepository, 'findInRange'>
  >;
  let accessibleBranches: jest.Mocked<
    Pick<AccessibleBranchesResolver, 'forCurrentUser'>
  >;
  let useCase: ListAppointmentsUseCase;

  beforeEach(() => {
    appointmentViewRepository = {
      findInRange: jest.fn().mockResolvedValue([]),
    };
    accessibleBranches = {
      forCurrentUser: jest.fn().mockResolvedValue(null),
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
      accessibleBranches as unknown as AccessibleBranchesResolver,
      clock,
    );
  });

  it('with no dates returns the business day, not the UTC one', async () => {
    await useCase.execute({});

    expect(appointmentViewRepository.findInRange).toHaveBeenCalledWith({
      from: new Date('2026-08-02T04:00:00.000Z'),
      toExclusive: new Date('2026-08-03T04:00:00.000Z'),
      professionalIds: undefined,
      serviceIds: undefined,
      statuses: undefined,
      branchId: undefined,
      branchIds: undefined,
    });
  });

  it('takes the whole range, with the last day included', async () => {
    await useCase.execute({ from: '2026-08-10', to: '2026-08-12' });

    expect(appointmentViewRepository.findInRange).toHaveBeenCalledWith({
      from: new Date('2026-08-10T04:00:00.000Z'),
      toExclusive: new Date('2026-08-13T04:00:00.000Z'),
      professionalIds: undefined,
      serviceIds: undefined,
      statuses: undefined,
      branchId: undefined,
      branchIds: undefined,
    });
  });

  it('filters by professional for a single-professional agenda', async () => {
    await useCase.execute({ professionalId: 'p1' });

    expect(appointmentViewRepository.findInRange).toHaveBeenCalledWith(
      expect.objectContaining({ professionalIds: ['p1'] }),
    );
  });

  it('forwards professional, service and status arrays', async () => {
    await useCase.execute({
      professionalIds: ['p1', 'p2'],
      serviceIds: ['s1'],
      statuses: ['confirmed' as never],
    });

    expect(appointmentViewRepository.findInRange).toHaveBeenCalledWith(
      expect.objectContaining({
        professionalIds: ['p1', 'p2'],
        serviceIds: ['s1'],
        statuses: ['confirmed'],
      }),
    );
  });

  it('scopes to accessible branches when the user is restricted', async () => {
    accessibleBranches.forCurrentUser.mockResolvedValue(['b1', 'b2']);

    await useCase.execute({});

    expect(appointmentViewRepository.findInRange).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: undefined,
        branchIds: ['b1', 'b2'],
      }),
    );
  });

  it('rejects a branch outside the accessible set', async () => {
    accessibleBranches.forCurrentUser.mockResolvedValue(['b1']);

    await expect(useCase.execute({ branchId: 'b9' })).rejects.toBeInstanceOf(
      BranchNotFoundError,
    );
    expect(appointmentViewRepository.findInRange).not.toHaveBeenCalled();
  });

  it('keeps an explicit branchId when it is accessible', async () => {
    accessibleBranches.forCurrentUser.mockResolvedValue(['b1', 'b2']);

    await useCase.execute({ branchId: 'b2' });

    expect(appointmentViewRepository.findInRange).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'b2',
        branchIds: undefined,
      }),
    );
  });

  it('rejects an inverted range', async () => {
    await expect(
      useCase.execute({ from: '2026-08-12', to: '2026-08-10' }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(appointmentViewRepository.findInRange).not.toHaveBeenCalled();
  });
});
