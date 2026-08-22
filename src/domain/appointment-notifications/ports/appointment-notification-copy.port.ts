import { AppointmentNotificationKind } from '../value-objects/appointment-notification-kind.vo';
import { NotificationCommandKind } from '../value-objects/notification-command.vo';

export interface AppointmentNotificationAlertCopyInput {
  eventId: string;
  kind: AppointmentNotificationKind;
  clientDisplayName: string;
  serviceName: string;
  professionalName: string;
  branchName: string;
  startsAtLabel: string;
  previousStartsAtLabel?: string | null;
  isDigest?: boolean;
  digestCount?: number;
}

export interface AppointmentNotificationCopyPort {
  renderAlert(input: AppointmentNotificationAlertCopyInput): string;
  handshakeReply(kind: NotificationCommandKind): string;
}

export const APPOINTMENT_NOTIFICATION_COPY_PORT =
  'AppointmentNotificationCopyPort';
