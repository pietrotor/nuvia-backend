import { AppointmentReminder } from '../entities/appointment-reminder.entity';
import { AppointmentReminderKind } from '../value-objects/appointment-reminder-kind.vo';

export interface UpsertAppointmentReminderData {
  appointmentId: string;
  kind: AppointmentReminderKind;
  destinationPhoneE164: string;
  nextAttemptAt: Date;
}

export interface AppointmentReminderRepository {
  upsertMany(rows: UpsertAppointmentReminderData[]): Promise<void>;
  cancelOpen(input: {
    appointmentId: string;
    kinds?: AppointmentReminderKind[];
    now: Date;
  }): Promise<number>;
  save(reminder: AppointmentReminder): Promise<AppointmentReminder>;
  tryMarkDispatching(input: {
    id: string;
    renderedContent: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<AppointmentReminder | null>;
  findById(id: string): Promise<AppointmentReminder | null>;
  findByAppointmentAndKind(input: {
    appointmentId: string;
    kind: AppointmentReminderKind;
  }): Promise<AppointmentReminder | null>;
  claimDueUnscoped(now: Date, limit: number): Promise<AppointmentReminder[]>;
}

export const APPOINTMENT_REMINDER_REPOSITORY = 'AppointmentReminderRepository';
