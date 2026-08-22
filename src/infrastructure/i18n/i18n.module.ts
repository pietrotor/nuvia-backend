import { Global, Module } from '@nestjs/common';

import { APPOINTMENT_NOTIFICATION_COPY_PORT } from '@domain/appointment-notifications/ports/appointment-notification-copy.port';
import { AppointmentNotificationCopyAdapter } from './appointment-notification-copy.adapter';
import { ClientReminderCopyAdapter } from './client-reminder-copy.adapter';
import { I18nService } from './i18n.service';
import { CLIENT_REMINDER_COPY_PORT } from '@domain/reminders/ports/client-reminder-copy.port';

@Global()
@Module({
  providers: [
    I18nService,
    AppointmentNotificationCopyAdapter,
    ClientReminderCopyAdapter,
    {
      provide: APPOINTMENT_NOTIFICATION_COPY_PORT,
      useExisting: AppointmentNotificationCopyAdapter,
    },
    {
      provide: CLIENT_REMINDER_COPY_PORT,
      useExisting: ClientReminderCopyAdapter,
    },
  ],
  exports: [
    I18nService,
    APPOINTMENT_NOTIFICATION_COPY_PORT,
    CLIENT_REMINDER_COPY_PORT,
  ],
})
export class I18nModule {}
