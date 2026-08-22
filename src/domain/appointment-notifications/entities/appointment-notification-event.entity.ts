import { AppointmentSlotSnapshot } from '../value-objects/appointment-slot-snapshot.vo';
import { AppointmentNotificationKind } from '../value-objects/appointment-notification-kind.vo';

export interface AppointmentNotificationEventProps {
  id: string;
  tenantId: string;
  appointmentId: string;
  sequence: number;
  kind: AppointmentNotificationKind;
  previous: AppointmentSlotSnapshot | null;
  current: AppointmentSlotSnapshot;
  occurredAt: Date;
  expandedAt: Date | null;
  attemptCount: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AppointmentNotificationEvent {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly appointmentId: string;
  public readonly sequence: number;
  public readonly kind: AppointmentNotificationKind;
  public readonly previous: AppointmentSlotSnapshot | null;
  public readonly current: AppointmentSlotSnapshot;
  public readonly occurredAt: Date;
  public readonly expandedAt: Date | null;
  public readonly attemptCount: number;
  public readonly nextAttemptAt: Date;
  public readonly lastError: string | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: AppointmentNotificationEventProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.appointmentId = props.appointmentId;
    this.sequence = props.sequence;
    this.kind = props.kind;
    this.previous = props.previous;
    this.current = props.current;
    this.occurredAt = props.occurredAt;
    this.expandedAt = props.expandedAt;
    this.attemptCount = props.attemptCount;
    this.nextAttemptAt = props.nextAttemptAt;
    this.lastError = props.lastError;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  markExpanded(now: Date): AppointmentNotificationEvent {
    return new AppointmentNotificationEvent({
      ...this,
      expandedAt: now,
      lastError: null,
    });
  }

  retryLater(input: {
    nextAttemptAt: Date;
    lastError: string;
  }): AppointmentNotificationEvent {
    return new AppointmentNotificationEvent({
      ...this,
      attemptCount: this.attemptCount + 1,
      nextAttemptAt: input.nextAttemptAt,
      lastError: input.lastError,
    });
  }

  scopeIds(): { professionalIds: string[]; branchIds: string[] } {
    const professionalIds = new Set<string>([this.current.professionalId]);
    const branchIds = new Set<string>([this.current.branchId]);
    if (
      this.kind === AppointmentNotificationKind.RESCHEDULED &&
      this.previous
    ) {
      professionalIds.add(this.previous.professionalId);
      branchIds.add(this.previous.branchId);
    }
    return {
      professionalIds: [...professionalIds],
      branchIds: [...branchIds],
    };
  }
}
