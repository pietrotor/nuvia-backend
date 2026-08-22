import { AppointmentReminderKind } from '../value-objects/appointment-reminder-kind.vo';

export interface ClientReminderCopyInput {
  reminderId: string;
  kind: AppointmentReminderKind;
  agentName: string;
  serviceName: string;
  professionalName: string;
  branchName: string;
  startsAtLabel: string;
  depositPending: boolean;
}

export interface ClientReminderCopyPort {
  render(input: ClientReminderCopyInput): string;
}

export const CLIENT_REMINDER_COPY_PORT = 'ClientReminderCopyPort';
