import { Inject, Injectable } from '@nestjs/common';

import { DisableNotificationSubscriptionUseCase } from './disable-notification-subscription.use-case';
import {
  APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY,
  AppointmentNotificationSubscriptionRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';

@Injectable()
export class DisableProfessionalNotificationUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionals: ProfessionalRepository,
    @Inject(APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: AppointmentNotificationSubscriptionRepository,
    private readonly disableSubscription: DisableNotificationSubscriptionUseCase,
  ) {}

  async execute(professionalId: string): Promise<void> {
    const professional = await this.professionals.findById(professionalId);
    if (!professional) throw new ProfessionalNotFoundError(professionalId);

    const current =
      await this.subscriptions.findEnabledByProfessional(professionalId);
    for (const subscription of current) {
      await this.disableSubscription.execute({
        subscriptionId: subscription.id,
        professionalId,
      });
    }
  }
}
