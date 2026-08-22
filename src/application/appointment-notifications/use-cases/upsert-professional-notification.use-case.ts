import { Inject, Injectable } from '@nestjs/common';

import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { TenantCountryService } from '@application/common/services/tenant-country.service';
import { NotificationSubscriptionView } from '../dto/notification-subscription-view';
import { UpsertProfessionalNotificationDto } from '../dto/upsert-professional-notification.dto';
import { EnsureNotificationContactService } from '../services/ensure-notification-contact.service';
import {
  APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
  AppointmentNotificationDeliveryRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import {
  APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY,
  AppointmentNotificationSubscriptionRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import { InvalidPhoneNumberError } from '@domain/common/exceptions/phone.exceptions';
import { NotificationProfessionalAlreadySubscribedError } from '@domain/appointment-notifications/exceptions/appointment-notification.exceptions';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { DomainException, ErrorCode } from '@domain/common/exceptions';

@Injectable()
export class UpsertProfessionalNotificationUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionals: ProfessionalRepository,
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
    professionalId: string,
    dto: UpsertProfessionalNotificationDto,
  ): Promise<NotificationSubscriptionView> {
    const professional = await this.professionals.findById(professionalId);
    if (!professional) throw new ProfessionalNotFoundError(professionalId);

    const current =
      await this.subscriptions.findEnabledByProfessional(professionalId);
    const now = this.clock.now();
    const tenantId = this.tenantContext.tenantId;
    if (!tenantId) throw new ProfessionalNotFoundError(professionalId);

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

    const matching = current.find(
      (subscription) => subscription.contactId === ensured.contact.id,
    );
    if (matching) {
      return {
        subscription: matching,
        contact: ensured.contact,
        latestDelivery: await this.deliveries.findLatestForContact(
          ensured.contact.id,
        ),
        activationCode: ensured.activationCode ?? undefined,
      };
    }

    for (const subscription of current) {
      await this.subscriptions.save(subscription.disable(now));
    }

    try {
      const created = await this.subscriptions.create({
        contactId: ensured.contact.id,
        professionalId,
        enabledAt: now,
      });
      return {
        subscription: created,
        contact: ensured.contact,
        latestDelivery: await this.deliveries.findLatestForContact(
          ensured.contact.id,
        ),
        activationCode: ensured.activationCode ?? undefined,
      };
    } catch (error) {
      if (
        error instanceof DomainException &&
        error.code === ErrorCode.DUPLICATE_RECORD
      ) {
        throw new NotificationProfessionalAlreadySubscribedError();
      }
      throw error;
    }
  }
}
