import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { NotificationSettingsView } from '@application/appointment-notifications/dto/notification-subscription-view';
import { NotificationSubscriptionView } from '@application/appointment-notifications/dto/notification-subscription-view';
import { AppointmentNotificationDeliveryStatus } from '@domain/appointment-notifications/value-objects/appointment-notification-delivery-status.vo';
import { NotificationContactStatus } from '@domain/appointment-notifications/value-objects/notification-contact-status.vo';

export class NotificationDeliverySummaryDto {
  @ApiProperty()
  status: AppointmentNotificationDeliveryStatus;

  @ApiPropertyOptional({ nullable: true, type: String })
  lastErrorCode: string | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  acceptedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  deliveredAt: Date | null;

  @ApiPropertyOptional({ nullable: true, type: Date })
  failedAt: Date | null;
}

export class NotificationSubscriptionResponseDto {
  @ApiProperty()
  subscriptionId: string;

  @ApiProperty()
  contactId: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  maskedPhone: string;

  @ApiProperty({ enum: NotificationContactStatus })
  contactStatus: NotificationContactStatus;

  @ApiPropertyOptional({ nullable: true, type: String })
  professionalId: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  branchId: string | null;

  @ApiProperty()
  enabledAt: Date;

  @ApiPropertyOptional({
    description:
      'Plain activation code, only present right after creating or refreshing a pending contact',
    nullable: true,
    type: String,
  })
  activationCode: string | null;

  @ApiPropertyOptional({ type: NotificationDeliverySummaryDto, nullable: true })
  latestDelivery: NotificationDeliverySummaryDto | null;

  static from(
    view: NotificationSubscriptionView,
    options?: { maskedPhone?: string },
  ): NotificationSubscriptionResponseDto {
    const latest = view.latestDelivery;
    return {
      subscriptionId: view.subscription.id,
      contactId: view.contact.id,
      displayName: view.contact.displayName,
      maskedPhone: options?.maskedPhone ?? view.contact.maskedPhone(),
      contactStatus: view.contact.status,
      professionalId: view.subscription.professionalId,
      branchId: view.subscription.branchId,
      enabledAt: view.subscription.enabledAt,
      activationCode: view.activationCode ?? null,
      latestDelivery: latest
        ? {
            status: latest.status,
            lastErrorCode: latest.lastErrorCode,
            acceptedAt: latest.acceptedAt,
            deliveredAt: latest.deliveredAt,
            failedAt: latest.failedAt,
          }
        : null,
    };
  }
}

export class NotificationSettingsResponseDto {
  @ApiProperty({ type: [NotificationSubscriptionResponseDto] })
  subscriptions: NotificationSubscriptionResponseDto[];

  @ApiProperty()
  outboundBreakerOpen: boolean;

  @ApiProperty()
  internalBudgetDegraded: boolean;

  static from(
    view: NotificationSettingsView,
    options?: {
      countryCode?: string;
      formatMasked?: (phone: string) => string;
    },
  ): NotificationSettingsResponseDto {
    return {
      subscriptions: view.subscriptions.map((subscription) =>
        NotificationSubscriptionResponseDto.from(subscription, {
          maskedPhone: options?.formatMasked
            ? options.formatMasked(subscription.contact.phoneE164)
            : undefined,
        }),
      ),
      outboundBreakerOpen: view.safety.breakerOpen,
      internalBudgetDegraded: view.safety.internalBudgetDegraded,
    };
  }
}
