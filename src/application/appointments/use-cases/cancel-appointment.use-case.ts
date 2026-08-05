import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Appointment } from '@domain/appointments/entities/appointment.entity';
import { AppointmentNotFoundError } from '@domain/appointments/exceptions/appointment.exceptions';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import { isDepositAtRisk } from '@domain/appointments/services/deposit-risk';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import { CancelAppointmentDto } from '../dto/cancel-appointment.dto';

export interface CancelAppointmentResult {
  appointment: Appointment;
  depositAtRisk: boolean;
}

@Injectable()
export class CancelAppointmentUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    private readonly audit: AuditRecorder,
  ) {}

  // restrictToClientId narrows the operation to a single client's appointments:
  // the agent may only cancel the ones from the ongoing conversation.
  async execute(
    id: string,
    dto: CancelAppointmentDto = {},
    restrictToClientId?: string,
  ): Promise<CancelAppointmentResult> {
    const current = await this.appointmentRepository.findById(id);
    if (
      !current ||
      (restrictToClientId && !current.belongsTo(restrictToClientId))
    ) {
      throw new AppointmentNotFoundError(id);
    }

    const [service, config] = await Promise.all([
      this.serviceRepository.findById(current.serviceId),
      this.businessConfigRepository.findByTenant(),
    ]);
    if (!service) throw new ServiceNotFoundError(current.serviceId);
    if (!config) throw new BusinessConfigNotFoundError();

    const appointment = await this.appointmentRepository.save(current.cancel());

    await this.audit.record({
      action: AuditAction.APPOINTMENT_CANCELLED,
      entity: 'appointment',
      entityId: appointment.id,
      before: { status: current.status, startsAt: current.startsAt },
      after: { status: appointment.status, reason: dto.reason ?? null },
    });

    return {
      appointment,
      depositAtRisk: isDepositAtRisk({
        appointment: current,
        service,
        config,
        now: this.clock.now(),
      }),
    };
  }
}
