import { ClientSummary } from '@domain/clients/views/client-summary';
import { ProfessionalSummary } from '@domain/professionals/views/professional-summary';
import { ServiceSummary } from '@domain/services/views/service-summary';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';

// Read side of the schedule: the appointment plus what a screen needs to show about the
// client, professional and service. The entity travels whole so its rules are not
// duplicated, and the surrounding data is resolved by the same query.
export interface AppointmentView {
  appointment: Appointment;
  client: ClientSummary;
  professional: ProfessionalSummary;
  service: ServiceSummary;
}

export interface AppointmentViewRepository {
  findInRange(input: {
    from: Date;
    toExclusive: Date;
    professionalId?: string;
  }): Promise<AppointmentView[]>;
  findByClient(input: {
    clientId: string;
    statuses?: AppointmentStatus[];
    from?: Date;
  }): Promise<AppointmentView[]>;
}

export const APPOINTMENT_VIEW_REPOSITORY = 'AppointmentViewRepository';
