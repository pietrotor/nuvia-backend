import { Inject, Injectable } from '@nestjs/common';

import { NotificationSubscriptionNotFoundError } from '@domain/appointment-notifications/exceptions/appointment-notification.exceptions';
import {
  APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY,
  AppointmentNotificationSubscriptionRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';

export interface DisableNotificationSubscriptionInput {
  subscriptionId: string;
  professionalId?: string;
  branchId?: string;
}

@Injectable()
export class DisableNotificationSubscriptionUseCase {
  constructor(
    @Inject(APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: AppointmentNotificationSubscriptionRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(input: DisableNotificationSubscriptionInput): Promise<void> {
    const subscription = await this.subscriptions.findById(
      input.subscriptionId,
    );
    if (!subscription) {
      throw new NotificationSubscriptionNotFoundError(input.subscriptionId);
    }
    if (
      input.professionalId &&
      subscription.professionalId !== input.professionalId
    ) {
      throw new NotificationSubscriptionNotFoundError(input.subscriptionId);
    }
    if (input.branchId && subscription.branchId !== input.branchId) {
      throw new NotificationSubscriptionNotFoundError(input.subscriptionId);
    }
    await this.subscriptions.save(subscription.disable(this.clock.now()));
  }
}
