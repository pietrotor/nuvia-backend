import { AppointmentNotificationSubscription } from '../entities/appointment-notification-subscription.entity';

export interface CreateNotificationSubscriptionData {
  contactId: string;
  professionalId?: string | null;
  branchId?: string | null;
  enabledAt: Date;
}

export interface AppointmentNotificationSubscriptionRepository {
  create(
    data: CreateNotificationSubscriptionData,
  ): Promise<AppointmentNotificationSubscription>;
  save(
    subscription: AppointmentNotificationSubscription,
  ): Promise<AppointmentNotificationSubscription>;
  findById(id: string): Promise<AppointmentNotificationSubscription | null>;
  findEnabledByProfessional(
    professionalId: string,
  ): Promise<AppointmentNotificationSubscription[]>;
  findEnabledByBranch(
    branchId: string,
  ): Promise<AppointmentNotificationSubscription[]>;
  findEnabledByProfessionals(
    professionalIds: string[],
  ): Promise<AppointmentNotificationSubscription[]>;
  findEnabledByBranches(
    branchIds: string[],
  ): Promise<AppointmentNotificationSubscription[]>;
  countEnabledByBranch(branchId: string): Promise<number>;
}

export const APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY =
  'AppointmentNotificationSubscriptionRepository';
