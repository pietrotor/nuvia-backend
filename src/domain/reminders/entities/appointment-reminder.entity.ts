import { AppointmentReminderKind } from '../value-objects/appointment-reminder-kind.vo';
import { AppointmentReminderStatus } from '../value-objects/appointment-reminder-status.vo';

export interface AppointmentReminderProps {
  id: string;
  tenantId: string;
  appointmentId: string;
  kind: AppointmentReminderKind;
  destinationPhoneE164: string;
  renderedContent: string | null;
  status: AppointmentReminderStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  leaseUntil: Date | null;
  providerMessageId: string | null;
  acceptedAt: Date | null;
  failedAt: Date | null;
  lastErrorCode: string | null;
  lastError: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AppointmentReminder {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly appointmentId: string;
  public readonly kind: AppointmentReminderKind;
  public readonly destinationPhoneE164: string;
  public readonly renderedContent: string | null;
  public readonly status: AppointmentReminderStatus;
  public readonly attemptCount: number;
  public readonly nextAttemptAt: Date;
  public readonly leaseUntil: Date | null;
  public readonly providerMessageId: string | null;
  public readonly acceptedAt: Date | null;
  public readonly failedAt: Date | null;
  public readonly lastErrorCode: string | null;
  public readonly lastError: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: AppointmentReminderProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.appointmentId = props.appointmentId;
    this.kind = props.kind;
    this.destinationPhoneE164 = props.destinationPhoneE164;
    this.renderedContent = props.renderedContent;
    this.status = props.status;
    this.attemptCount = props.attemptCount;
    this.nextAttemptAt = props.nextAttemptAt;
    this.leaseUntil = props.leaseUntil;
    this.providerMessageId = props.providerMessageId;
    this.acceptedAt = props.acceptedAt;
    this.failedAt = props.failedAt;
    this.lastErrorCode = props.lastErrorCode;
    this.lastError = props.lastError;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isOpen(): boolean {
    return (
      this.status === AppointmentReminderStatus.PENDING ||
      this.status === AppointmentReminderStatus.DEFERRED ||
      this.status === AppointmentReminderStatus.DISPATCHING
    );
  }

  withContent(renderedContent: string): AppointmentReminder {
    return new AppointmentReminder({ ...this, renderedContent });
  }

  markDispatching(input: { leaseUntil: Date }): AppointmentReminder {
    return new AppointmentReminder({
      ...this,
      status: AppointmentReminderStatus.DISPATCHING,
      leaseUntil: input.leaseUntil,
      attemptCount: this.attemptCount + 1,
    });
  }

  defer(nextAttemptAt: Date): AppointmentReminder {
    return new AppointmentReminder({
      ...this,
      status: AppointmentReminderStatus.DEFERRED,
      nextAttemptAt,
      leaseUntil: null,
    });
  }

  markAccepted(input: {
    now: Date;
    providerMessageId: string;
  }): AppointmentReminder {
    return new AppointmentReminder({
      ...this,
      status: AppointmentReminderStatus.ACCEPTED,
      providerMessageId: input.providerMessageId,
      acceptedAt: input.now,
      leaseUntil: null,
      lastError: null,
      lastErrorCode: null,
    });
  }

  markUnknown(input: { now: Date; lastError: string }): AppointmentReminder {
    return new AppointmentReminder({
      ...this,
      status: AppointmentReminderStatus.UNKNOWN,
      failedAt: input.now,
      leaseUntil: null,
      lastErrorCode: 'unknown',
      lastError: input.lastError,
    });
  }

  markFailed(input: {
    now: Date;
    lastErrorCode: string;
    lastError: string;
  }): AppointmentReminder {
    return new AppointmentReminder({
      ...this,
      status: AppointmentReminderStatus.FAILED,
      failedAt: input.now,
      leaseUntil: null,
      lastErrorCode: input.lastErrorCode,
      lastError: input.lastError,
    });
  }

  suppress(input: { now: Date; lastErrorCode: string }): AppointmentReminder {
    return new AppointmentReminder({
      ...this,
      status: AppointmentReminderStatus.SUPPRESSED,
      failedAt: input.now,
      leaseUntil: null,
      lastErrorCode: input.lastErrorCode,
      lastError: null,
    });
  }
}
