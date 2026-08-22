import { Inject, Injectable } from '@nestjs/common';

import {
  APPOINTMENT_REMINDER_REPOSITORY,
  AppointmentReminderRepository,
} from '@domain/reminders/repositories/appointment-reminder.repository';
import { REMINDER_DISPATCH_BATCH_SIZE } from '@domain/reminders/services/reminder-limits';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';

export interface ReminderDispatchBatch {
  reminderIds: { tenantId: string; reminderId: string }[];
}

@Injectable()
export class DispatchAppointmentRemindersUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_REPOSITORY)
    private readonly reminders: AppointmentReminderRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<ReminderDispatchBatch> {
    const due = await this.reminders.claimDueUnscoped(
      this.clock.now(),
      REMINDER_DISPATCH_BATCH_SIZE,
    );
    return {
      reminderIds: due.map((reminder) => ({
        tenantId: reminder.tenantId,
        reminderId: reminder.id,
      })),
    };
  }
}
