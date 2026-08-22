import { Money } from '@domain/common/value-objects/money.vo';

import { InvalidAppointmentTransitionError } from '../exceptions/appointment.exceptions';
import { AppointmentBookingAnswer } from '../value-objects/appointment-booking-answer.vo';

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
type AppointmentChange =
  | AppointmentStatus
  | 'reschedule'
  | 'attach_deposit_receipt';

export interface DepositReceipt {
  id?: string;
  storageKey: string;
  mimeType: string;
  receivedAt: Date;
  providerMessageId: string | null;
}

export interface AppointmentProps {
  id: string;
  tenantId: string;
  branchId: string;
  clientId: string;
  bookingContactClientId?: string;
  professionalId: string;
  serviceId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  // Snapshot at booking time: branch price overrides make a live join unsafe.
  price: Money;
  depositAmount?: Money | null;
  depositReceipt?: DepositReceipt | null;
  depositVerifiedAt?: Date | null;
  depositVerifiedByUserId?: string | null;
  bookingAnswers?: AppointmentBookingAnswer[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class Appointment {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly branchId: string;
  public readonly clientId: string;
  public readonly bookingContactClientId: string;
  public readonly professionalId: string;
  public readonly serviceId: string;
  public readonly startsAt: Date;
  public readonly endsAt: Date;
  public readonly status: AppointmentStatus;
  public readonly price: Money;
  public readonly depositAmount: Money | null;
  public readonly depositReceipt: DepositReceipt | null;
  public readonly depositVerifiedAt: Date | null;
  public readonly depositVerifiedByUserId: string | null;
  public readonly bookingAnswers: AppointmentBookingAnswer[];
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: AppointmentProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.clientId = props.clientId;
    this.bookingContactClientId =
      props.bookingContactClientId ?? props.clientId;
    this.professionalId = props.professionalId;
    this.serviceId = props.serviceId;
    this.startsAt = props.startsAt;
    this.endsAt = props.endsAt;
    this.status = props.status;
    this.price = props.price;
    this.depositAmount = props.depositAmount ?? null;
    this.depositReceipt = props.depositReceipt ?? null;
    this.depositVerifiedAt = props.depositVerifiedAt ?? null;
    this.depositVerifiedByUserId = props.depositVerifiedByUserId ?? null;
    this.bookingAnswers = props.bookingAnswers ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isActiveSlot(): boolean {
    return ACTIVE_APPOINTMENT_STATUSES.includes(this.status);
  }

  belongsTo(clientId: string): boolean {
    return (
      this.clientId === clientId || this.bookingContactClientId === clientId
    );
  }

  rescheduleTo(
    startsAt: Date,
    endsAt: Date,
    changes?: {
      professionalId?: string;
      branchId?: string;
      price?: Money;
      depositAmount?: Money | null;
    },
  ): Appointment {
    this.assertActive('reschedule');
    return new Appointment({
      ...this,
      startsAt,
      endsAt,
      professionalId: changes?.professionalId ?? this.professionalId,
      branchId: changes?.branchId ?? this.branchId,
      price: changes?.price ?? this.price,
      depositAmount:
        changes?.depositAmount !== undefined
          ? changes.depositAmount
          : this.depositAmount,
    });
  }

  cancel(): Appointment {
    this.assertActive(AppointmentStatus.CANCELLED);
    return new Appointment({ ...this, status: AppointmentStatus.CANCELLED });
  }

  attachReceipt(receipt: DepositReceipt): Appointment {
    this.assertCanReceiveDepositReceipt();
    return new Appointment({ ...this, depositReceipt: receipt });
  }

  assertCanReceiveDepositReceipt(): void {
    this.assertCurrentStatus(
      AppointmentStatus.PENDING_DEPOSIT,
      'attach_deposit_receipt',
    );
  }

  confirmDeposit(input: {
    verifiedAt: Date;
    verifiedByUserId: string;
  }): Appointment {
    this.assertCurrentStatus(
      AppointmentStatus.PENDING_DEPOSIT,
      AppointmentStatus.CONFIRMED,
    );
    return new Appointment({
      ...this,
      status: AppointmentStatus.CONFIRMED,
      depositVerifiedAt: input.verifiedAt,
      depositVerifiedByUserId: input.verifiedByUserId,
    });
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
