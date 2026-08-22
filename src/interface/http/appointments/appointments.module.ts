import { Module } from '@nestjs/common';

import { AppointmentNotificationsModule } from '@application/appointment-notifications/appointment-notifications.module';
import { DepositsApplicationModule } from '@application/deposits/deposits-application.module';
import { RemindersModule } from '@application/reminders/reminders.module';
import { BookAppointmentUseCase } from '@application/appointments/use-cases/book-appointment.use-case';
import { CancelAppointmentUseCase } from '@application/appointments/use-cases/cancel-appointment.use-case';
import { FindAvailabilityOptionsUseCase } from '@application/appointments/use-cases/find-availability-options.use-case';
import { GetAppointmentUseCase } from '@application/appointments/use-cases/get-appointment.use-case';
import { GetAvailabilityUseCase } from '@application/appointments/use-cases/get-availability.use-case';
import { ListAppointmentsUseCase } from '@application/appointments/use-cases/list-appointments.use-case';
import { ListClientAppointmentsUseCase } from '@application/appointments/use-cases/list-client-appointments.use-case';
import { ListProfessionalAppointmentsUseCase } from '@application/appointments/use-cases/list-professional-appointments.use-case';
import { MarkAppointmentAttendedUseCase } from '@application/appointments/use-cases/mark-appointment-attended.use-case';
import { MarkAppointmentNoShowUseCase } from '@application/appointments/use-cases/mark-appointment-no-show.use-case';
import { RescheduleAppointmentUseCase } from '@application/appointments/use-cases/reschedule-appointment.use-case';
import { AppointmentSlotValidator } from '@application/appointments/services/appointment-slot-validator.service';
import { ScheduleContextResolver } from '@application/appointments/services/schedule-context-resolver.service';
import { AppointmentsController } from './appointments.controller';

@Module({
  imports: [
    AppointmentNotificationsModule,
    RemindersModule,
    DepositsApplicationModule,
  ],
  controllers: [AppointmentsController],
  providers: [
    ScheduleContextResolver,
    AppointmentSlotValidator,
    BookAppointmentUseCase,
    FindAvailabilityOptionsUseCase,
    GetAppointmentUseCase,
    GetAvailabilityUseCase,
    ListAppointmentsUseCase,
    ListClientAppointmentsUseCase,
    ListProfessionalAppointmentsUseCase,
    RescheduleAppointmentUseCase,
    CancelAppointmentUseCase,
    MarkAppointmentAttendedUseCase,
    MarkAppointmentNoShowUseCase,
  ],
  exports: [
    BookAppointmentUseCase,
    FindAvailabilityOptionsUseCase,
    GetAppointmentUseCase,
    GetAvailabilityUseCase,
    ListClientAppointmentsUseCase,
    ListProfessionalAppointmentsUseCase,
    RescheduleAppointmentUseCase,
    CancelAppointmentUseCase,
  ],
})
export class AppointmentsModule {}
