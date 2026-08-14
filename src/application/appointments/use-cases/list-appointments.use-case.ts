import { Inject, Injectable } from '@nestjs/common';

import { ListAppointmentsDto } from '@application/appointments/dto/list-appointments.dto';
import { ScheduleContextResolver } from '@application/appointments/services/schedule-context-resolver.service';
import { AccessibleBranchesResolver } from '@application/branches/services/accessible-branches.resolver';
import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentView,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { appointmentDateRangeIn } from '@domain/appointments/services/date-range';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import { ErrorCode, ValidationError } from '@domain/common/exceptions';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';

@Injectable()
export class ListAppointmentsUseCase {
  constructor(
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViewRepository: AppointmentViewRepository,
    private readonly scheduleContext: ScheduleContextResolver,
    private readonly accessibleBranches: AccessibleBranchesResolver,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(dto: ListAppointmentsDto): Promise<AppointmentView[]> {
    const timezone = await this.scheduleContext.tenantTimezone();
    const range = appointmentDateRangeIn({
      from: dto.from,
      to: dto.to,
      now: this.clock.now(),
      timezone,
    });
    if (!range) throw new ValidationError(ErrorCode.INVALID_TIME_RANGE);

    const allowedBranchIds = await this.accessibleBranches.forCurrentUser();
    let branchId = dto.branchId;
    let branchIds: string[] | undefined;

    if (allowedBranchIds) {
      if (dto.branchId) {
        if (!allowedBranchIds.includes(dto.branchId)) {
          throw new BranchNotFoundError(dto.branchId);
        }
      } else {
        branchId = undefined;
        branchIds = allowedBranchIds;
      }
    }

    const professionalIds = dto.professionalIds?.length
      ? dto.professionalIds
      : dto.professionalId
        ? [dto.professionalId]
        : undefined;

    return this.appointmentViewRepository.findInRange({
      ...range,
      professionalIds,
      serviceIds: dto.serviceIds?.length ? dto.serviceIds : undefined,
      statuses: dto.statuses?.length ? dto.statuses : undefined,
      branchId,
      branchIds,
    });
  }
}
