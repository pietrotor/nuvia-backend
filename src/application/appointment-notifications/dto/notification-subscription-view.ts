import { AppointmentNotificationDelivery } from '@domain/appointment-notifications/entities/appointment-notification-delivery.entity';
import { AppointmentNotificationSubscription } from '@domain/appointment-notifications/entities/appointment-notification-subscription.entity';
import { NotificationContact } from '@domain/appointment-notifications/entities/notification-contact.entity';
import { OutboundSafetySnapshot } from '@domain/messaging/ports/outbound-safety.port';

export interface NotificationSubscriptionView {
  subscription: AppointmentNotificationSubscription;
  contact: NotificationContact;
  latestDelivery: AppointmentNotificationDelivery | null;
  activationCode?: string;
}

export interface NotificationSettingsView {
  subscriptions: NotificationSubscriptionView[];
  safety: OutboundSafetySnapshot;
}
