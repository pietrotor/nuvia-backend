import { Module } from '@nestjs/common';

import { AddBranchNotificationObserverUseCase } from './use-cases/add-branch-notification-observer.use-case';
import { DisableNotificationSubscriptionUseCase } from './use-cases/disable-notification-subscription.use-case';
import { DisableProfessionalNotificationUseCase } from './use-cases/disable-professional-notification.use-case';
import { DispatchAppointmentNotificationsUseCase } from './use-cases/dispatch-appointment-notifications.use-case';
import { ExpandAppointmentNotificationEventUseCase } from './use-cases/expand-appointment-notification-event.use-case';
import { HandleNotificationCommandUseCase } from './use-cases/handle-notification-command.use-case';
import { ListBranchNotificationObserversUseCase } from './use-cases/list-branch-notification-observers.use-case';
import { ListProfessionalNotificationsUseCase } from './use-cases/list-professional-notifications.use-case';
import { ProcessNotificationDeliveryStatusUseCase } from './use-cases/process-notification-delivery-status.use-case';
import { SendAppointmentNotificationDeliveryUseCase } from './use-cases/send-appointment-notification-delivery.use-case';
import { UpsertProfessionalNotificationUseCase } from './use-cases/upsert-professional-notification.use-case';
import { AppointmentNotificationPublisher } from './services/appointment-notification.publisher';
import { EnsureNotificationContactService } from './services/ensure-notification-contact.service';

const providers = [
  EnsureNotificationContactService,
  AppointmentNotificationPublisher,
  UpsertProfessionalNotificationUseCase,
  AddBranchNotificationObserverUseCase,
  ListProfessionalNotificationsUseCase,
  ListBranchNotificationObserversUseCase,
  DisableNotificationSubscriptionUseCase,
  DisableProfessionalNotificationUseCase,
  ExpandAppointmentNotificationEventUseCase,
  SendAppointmentNotificationDeliveryUseCase,
  HandleNotificationCommandUseCase,
  ProcessNotificationDeliveryStatusUseCase,
  DispatchAppointmentNotificationsUseCase,
];

@Module({
  providers,
  exports: providers,
})
export class AppointmentNotificationsModule {}
