import { Module } from '@nestjs/common';

import { AppointmentReminderPublisher } from './services/appointment-reminder.publisher';
import { DispatchAppointmentRemindersUseCase } from './use-cases/dispatch-appointment-reminders.use-case';
import { SendAppointmentReminderUseCase } from './use-cases/send-appointment-reminder.use-case';

const providers = [
  AppointmentReminderPublisher,
  DispatchAppointmentRemindersUseCase,
  SendAppointmentReminderUseCase,
];

@Module({
  providers,
  exports: providers,
})
export class RemindersModule {}
