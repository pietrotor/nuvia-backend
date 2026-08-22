import { Inject, Injectable } from '@nestjs/common';

import { NotificationSettingsView } from '../dto/notification-subscription-view';
import {
  APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
  AppointmentNotificationDeliveryRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import {
  APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY,
  AppointmentNotificationSubscriptionRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import {
  NOTIFICATION_CONTACT_REPOSITORY,
  NotificationContactRepository,
} from '@domain/appointment-notifications/repositories/notification-contact.repository';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import {
  OUTBOUND_SAFETY_PORT,
  OutboundSafetyPort,
} from '@domain/messaging/ports/outbound-safety.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

@Injectable()
export class ListBranchNotificationObserversUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branches: BranchRepository,
    @Inject(APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: AppointmentNotificationSubscriptionRepository,
    @Inject(NOTIFICATION_CONTACT_REPOSITORY)
    private readonly contacts: NotificationContactRepository,
    @Inject(APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY)
    private readonly deliveries: AppointmentNotificationDeliveryRepository,
    @Inject(OUTBOUND_SAFETY_PORT)
    private readonly outboundSafety: OutboundSafetyPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
  ) {}

  async execute(branchId: string): Promise<NotificationSettingsView> {
    const branch = await this.branches.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    const subscriptions =
      await this.subscriptions.findEnabledByBranch(branchId);
    const contactIds = [
      ...new Set(subscriptions.map((item) => item.contactId)),
    ];
    const contacts = await this.contacts.findByIds(contactIds);
    const contactsById = new Map(
      contacts.map((contact) => [contact.id, contact]),
    );
    const items = (
      await Promise.all(
        subscriptions.map(async (subscription) => {
          const contact = contactsById.get(subscription.contactId);
          if (!contact) return null;
          return {
            subscription,
            contact,
            latestDelivery: await this.deliveries.findLatestForContact(
              contact.id,
            ),
          };
        }),
      )
    ).filter((item) => item !== null);
    const tenantId = this.tenantContext.tenantId ?? branch.tenantId;
    return {
      subscriptions: items,
      safety: await this.outboundSafety.snapshot(tenantId),
    };
  }
}
