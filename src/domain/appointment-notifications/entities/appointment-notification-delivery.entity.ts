import { AppointmentNotificationDeliveryStatus } from '../value-objects/appointment-notification-delivery-status.vo';

export interface AppointmentNotificationDeliveryProps {
  id: string;
  tenantId: string;
  eventId: string;
  contactId: string;
  destinationPhoneE164: string;
  renderedContent: string | null;
  status: AppointmentNotificationDeliveryStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  leaseUntil: Date | null;
  providerMessageId: string | null;
  acceptedAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  lastErrorCode: string | null;
  lastError: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AppointmentNotificationDelivery {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly eventId: string;
  public readonly contactId: string;
  public readonly destinationPhoneE164: string;
  public readonly renderedContent: string | null;
  public readonly status: AppointmentNotificationDeliveryStatus;
  public readonly attemptCount: number;
  public readonly nextAttemptAt: Date;
  public readonly leaseUntil: Date | null;
  public readonly providerMessageId: string | null;
  public readonly acceptedAt: Date | null;
  public readonly deliveredAt: Date | null;
  public readonly failedAt: Date | null;
  public readonly lastErrorCode: string | null;
  public readonly lastError: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: AppointmentNotificationDeliveryProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.eventId = props.eventId;
    this.contactId = props.contactId;
    this.destinationPhoneE164 = props.destinationPhoneE164;
    this.renderedContent = props.renderedContent;
    this.status = props.status;
    this.attemptCount = props.attemptCount;
    this.nextAttemptAt = props.nextAttemptAt;
    this.leaseUntil = props.leaseUntil;
    this.providerMessageId = props.providerMessageId;
    this.acceptedAt = props.acceptedAt;
    this.deliveredAt = props.deliveredAt;
    this.failedAt = props.failedAt;
    this.lastErrorCode = props.lastErrorCode;
    this.lastError = props.lastError;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isOpen(): boolean {
    return (
      this.status === AppointmentNotificationDeliveryStatus.PENDING ||
      this.status === AppointmentNotificationDeliveryStatus.DEFERRED ||
      this.status === AppointmentNotificationDeliveryStatus.DISPATCHING
    );
  }

  withContent(renderedContent: string): AppointmentNotificationDelivery {
    return new AppointmentNotificationDelivery({ ...this, renderedContent });
  }

  markDispatching(input: {
    leaseUntil: Date;
  }): AppointmentNotificationDelivery {
    return new AppointmentNotificationDelivery({
      ...this,
      status: AppointmentNotificationDeliveryStatus.DISPATCHING,
      leaseUntil: input.leaseUntil,
      attemptCount: this.attemptCount + 1,
    });
  }

  defer(nextAttemptAt: Date): AppointmentNotificationDelivery {
    return new AppointmentNotificationDelivery({
      ...this,
      status: AppointmentNotificationDeliveryStatus.DEFERRED,
      nextAttemptAt,
      leaseUntil: null,
    });
  }

  markAccepted(input: {
    now: Date;
    providerMessageId: string;
  }): AppointmentNotificationDelivery {
    return new AppointmentNotificationDelivery({
      ...this,
      status: AppointmentNotificationDeliveryStatus.ACCEPTED,
      providerMessageId: input.providerMessageId,
      acceptedAt: input.now,
      leaseUntil: null,
      lastError: null,
      lastErrorCode: null,
    });
  }

  markDelivered(now: Date): AppointmentNotificationDelivery {
    return new AppointmentNotificationDelivery({
      ...this,
      status: AppointmentNotificationDeliveryStatus.DELIVERED,
      deliveredAt: now,
      leaseUntil: null,
    });
  }

  markUnknown(input: {
    now: Date;
    lastError: string;
  }): AppointmentNotificationDelivery {
    return new AppointmentNotificationDelivery({
      ...this,
      status: AppointmentNotificationDeliveryStatus.UNKNOWN,
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
  }): AppointmentNotificationDelivery {
    return new AppointmentNotificationDelivery({
      ...this,
      status: AppointmentNotificationDeliveryStatus.FAILED,
      failedAt: input.now,
      leaseUntil: null,
      lastErrorCode: input.lastErrorCode,
      lastError: input.lastError,
    });
  }

  suppress(input: {
    now: Date;
    lastErrorCode: string;
  }): AppointmentNotificationDelivery {
    return new AppointmentNotificationDelivery({
      ...this,
      status: AppointmentNotificationDeliveryStatus.SUPPRESSED,
      failedAt: input.now,
      leaseUntil: null,
      lastErrorCode: input.lastErrorCode,
      lastError: null,
    });
  }
}
