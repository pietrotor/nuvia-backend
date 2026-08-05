import { InvalidAppointmentTransitionError } from '../exceptions/appointment.exceptions';

export enum AppointmentStatus {
  PENDING_DEPOSIT = 'pending_deposit',
  CONFIRMED = 'confirmed',
  ATTENDED = 'attended',
  NO_SHOW = 'no_show',
  CANCELLED = 'cancelled',
  RELEASED = 'released',
}

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING_DEPOSIT,
  AppointmentStatus.CONFIRMED,
];

// What is being attempted on the appointment, so an invalid transition can be
// explained: rescheduling does not change the status, but it can still be forbidden.
type AppointmentChange = AppointmentStatus | 'reschedule';

export interface AppointmentProps {
  id: string;
  tenantId: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Appointment {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly clientId: string;
  public readonly professionalId: string;
  public readonly serviceId: string;
  public readonly startsAt: Date;
  public readonly endsAt: Date;
  public readonly status: AppointmentStatus;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: AppointmentProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.clientId = props.clientId;
    this.professionalId = props.professionalId;
    this.serviceId = props.serviceId;
    this.startsAt = props.startsAt;
    this.endsAt = props.endsAt;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isActiveSlot(): boolean {
    return ACTIVE_APPOINTMENT_STATUSES.includes(this.status);
  }

  belongsTo(clientId: string): boolean {
    return this.clientId === clientId;
  }

  rescheduleTo(
    startsAt: Date,
    endsAt: Date,
    professionalId?: string,
  ): Appointment {
    this.assertActive('reschedule');
    return new Appointment({
      ...this,
      startsAt,
      endsAt,
      professionalId: professionalId ?? this.professionalId,
    });
  }

  cancel(): Appointment {
    this.assertActive(AppointmentStatus.CANCELLED);
    return new Appointment({ ...this, status: AppointmentStatus.CANCELLED });
  }

  // Only from confirmed: an appointment with a pending deposit is attended after the
  // deposit is verified, so package balances and deposits are never skipped.
  markAttended(): Appointment {
    this.assertCurrentStatus(
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.ATTENDED,
    );
    return new Appointment({ ...this, status: AppointmentStatus.ATTENDED });
  }

  markNoShow(): Appointment {
    this.assertCurrentStatus(
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.NO_SHOW,
    );
    return new Appointment({ ...this, status: AppointmentStatus.NO_SHOW });
  }

  private assertActive(to: AppointmentChange): void {
    if (!this.isActiveSlot()) {
      throw new InvalidAppointmentTransitionError(this.status, to);
    }
  }

  private assertCurrentStatus(
    expected: AppointmentStatus,
    to: AppointmentChange,
  ): void {
    if (this.status !== expected) {
      throw new InvalidAppointmentTransitionError(this.status, to);
    }
  }
}
