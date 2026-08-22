import { AppointmentNotificationDelivery } from '../entities/appointment-notification-delivery.entity';
import { AppointmentNotificationDeliveryStatus } from '../value-objects/appointment-notification-delivery-status.vo';

export interface CreateAppointmentNotificationDeliveryData {
  eventId: string;
  contactId: string;
  destinationPhoneE164: string;
  nextAttemptAt: Date;
}

export interface AppointmentNotificationDeliveryRepository {
  createMany(
    rows: CreateAppointmentNotificationDeliveryData[],
  ): Promise<AppointmentNotificationDelivery[]>;
  save(
    delivery: AppointmentNotificationDelivery,
  ): Promise<AppointmentNotificationDelivery>;
  tryMarkDispatching(input: {
    id: string;
    renderedContent: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<AppointmentNotificationDelivery | null>;
  findById(id: string): Promise<AppointmentNotificationDelivery | null>;
  findByEventAndContact(input: {
    eventId: string;
    contactId: string;
  }): Promise<AppointmentNotificationDelivery | null>;
  findByProviderMessageId(
    providerMessageId: string,
  ): Promise<AppointmentNotificationDelivery | null>;
  claimDue(
    now: Date,
    limit: number,
  ): Promise<AppointmentNotificationDelivery[]>;
  claimDueUnscoped(
    now: Date,
    limit: number,
  ): Promise<AppointmentNotificationDelivery[]>;
  findOpenForContactSince(input: {
    contactId: string;
    since: Date;
  }): Promise<AppointmentNotificationDelivery[]>;
  findLatestForContact(
    contactId: string,
  ): Promise<AppointmentNotificationDelivery | null>;
  cancelOpenForContact(contactId: string, now: Date): Promise<number>;
}

export const APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY =
  'AppointmentNotificationDeliveryRepository';

export type { AppointmentNotificationDeliveryStatus };
