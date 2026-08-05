import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import { Service } from '@domain/services/entities/service.entity';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';

// Cancelling or rescheduling outside the policy window puts the deposit of a
// confirmed appointment at risk. Whether to refund it is the owner's call: here we only
// compute the warning, in a single place for cancel and reschedule.
// `appointment` is the appointment as it was before the change.
export function isDepositAtRisk(input: {
  appointment: Appointment;
  service: Service;
  config: BusinessConfig;
  now: Date;
}): boolean {
  return (
    input.service.requiresDeposit &&
    input.appointment.status === AppointmentStatus.CONFIRMED &&
    !input.config.allowsChangeWithoutPenalty(
      input.appointment.startsAt,
      input.now,
    )
  );
}
