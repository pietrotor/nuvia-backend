import { Inject, Injectable } from '@nestjs/common';

import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { TenantCountryService } from '@application/common/services/tenant-country.service';
import { AddBranchNotificationObserverDto } from '../dto/add-branch-notification-observer.dto';
import { NotificationSubscriptionView } from '../dto/notification-subscription-view';
import { EnsureNotificationContactService } from '../services/ensure-notification-contact.service';
import {
  APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
  AppointmentNotificationDeliveryRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import {
  APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY,
  AppointmentNotificationSubscriptionRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import { NotificationBranchObserverLimitError } from '@domain/appointment-notifications/exceptions/appointment-notification.exceptions';
import { MAX_BRANCH_NOTIFICATION_OBSERVERS } from '@domain/appointment-notifications/services/notification-limits';
import { InvalidPhoneNumberError } from '@domain/common/exceptions/phone.exceptions';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

@Injectable()
export class AddBranchNotificationObserverUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branches: BranchRepository,
    @Inject(APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: AppointmentNotificationSubscriptionRepository,
    @Inject(APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY)
    private readonly deliveries: AppointmentNotificationDeliveryRepository,
    private readonly ensureContact: EnsureNotificationContactService,
    private readonly phoneNumbers: PhoneNumberService,
    private readonly tenantCountry: TenantCountryService,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
  ) {}

  async execute(
    branchId: string,
    dto: AddBranchNotificationObserverDto,
  ): Promise<NotificationSubscriptionView> {
    const branch = await this.branches.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    const current = await this.subscriptions.findEnabledByBranch(branchId);
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId) throw new BranchNotFoundError(branchId);

    const country = await this.tenantCountry.getCurrentCountryCode();
    const phoneE164 = this.phoneNumbers.normalizeToE164(dto.phoneE164, country);
    if (!phoneE164) {
      throw new InvalidPhoneNumberError();
    }

    const ensured = await this.ensureContact.execute({
      tenantId,
      displayName: dto.displayName,
      phoneE164,
    });
    const existing = current.find(
      (subscription) => subscription.contactId === ensured.contact.id,
    );
    if (existing) {
      return {
        subscription: existing,
        contact: ensured.contact,
        latestDelivery: await this.deliveries.findLatestForContact(
          ensured.contact.id,
        ),
        activationCode: ensured.activationCode ?? undefined,
      };
    }

    if (current.length >= MAX_BRANCH_NOTIFICATION_OBSERVERS) {
      throw new NotificationBranchObserverLimitError(
        MAX_BRANCH_NOTIFICATION_OBSERVERS,
      );
    }

    const created = await this.subscriptions.create({
      contactId: ensured.contact.id,
      branchId,
      enabledAt: this.clock.now(),
    });
    return {
      subscription: created,
      contact: ensured.contact,
      latestDelivery: await this.deliveries.findLatestForContact(
        ensured.contact.id,
      ),
      activationCode: ensured.activationCode ?? undefined,
    };
  }
}
