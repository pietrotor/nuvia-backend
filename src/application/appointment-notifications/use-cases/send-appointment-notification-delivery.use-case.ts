import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import {
  APPOINTMENT_NOTIFICATION_COPY_PORT,
  AppointmentNotificationCopyPort,
} from '@domain/appointment-notifications/ports/appointment-notification-copy.port';
import {
  APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY,
  AppointmentNotificationDeliveryRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import {
  APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY,
  AppointmentNotificationEventRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-event.repository';
import {
  NOTIFICATION_CONTACT_REPOSITORY,
  NotificationContactRepository,
} from '@domain/appointment-notifications/repositories/notification-contact.repository';
import {
  APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY,
  AppointmentNotificationSubscriptionRepository,
} from '@domain/appointment-notifications/repositories/appointment-notification-subscription.repository';
import { AppointmentNotificationKind } from '@domain/appointment-notifications/value-objects/appointment-notification-kind.vo';
import {
  NOTIFICATION_DIGEST_THRESHOLD,
  NOTIFICATION_DIGEST_WINDOW_MS,
} from '@domain/appointment-notifications/services/notification-limits';
import {
  isEmergencyWindow,
  isQuietHour,
  nextQuietResumeAt,
  notificationTimezone,
} from '@domain/appointment-notifications/services/quiet-hours';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { DomainException, ErrorCode } from '@domain/common/exceptions';
import {
  MESSAGING_PORT,
  MessagingPort,
  OutboundClass,
} from '@domain/messaging/ports/messaging.port';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';

@Injectable()
export class SendAppointmentNotificationDeliveryUseCase {
  constructor(
    @Inject(APPOINTMENT_NOTIFICATION_DELIVERY_REPOSITORY)
    private readonly deliveries: AppointmentNotificationDeliveryRepository,
    @Inject(APPOINTMENT_NOTIFICATION_EVENT_REPOSITORY)
    private readonly events: AppointmentNotificationEventRepository,
    @Inject(NOTIFICATION_CONTACT_REPOSITORY)
    private readonly contacts: NotificationContactRepository,
    @Inject(APPOINTMENT_NOTIFICATION_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: AppointmentNotificationSubscriptionRepository,
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViews: AppointmentViewRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branches: BranchRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenants: TenantRepository,
    @Inject(APPOINTMENT_NOTIFICATION_COPY_PORT)
    private readonly copy: AppointmentNotificationCopyPort,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(deliveryId: string): Promise<void> {
    const delivery = await this.deliveries.findById(deliveryId);
    if (!delivery || !delivery.isOpen()) return;

    const [event, contact] = await Promise.all([
      this.events.findById(delivery.eventId),
      this.contacts.findById(delivery.contactId),
    ]);
    if (!event || !contact) {
      await this.deliveries.save(
        delivery.suppress({ now: this.clock.now(), lastErrorCode: 'missing' }),
      );
      return;
    }

    const later = await this.events.findLaterForAppointment({
      appointmentId: event.appointmentId,
      afterSequence: event.sequence,
    });
    if (later.length > 0) {
      await this.deliveries.save(
        delivery.suppress({
          now: this.clock.now(),
          lastErrorCode: 'superseded',
        }),
      );
      return;
    }

    if (!contact.canReceiveAlerts()) {
      await this.deliveries.save(
        delivery.suppress({
          now: this.clock.now(),
          lastErrorCode: 'contact_inactive',
        }),
      );
      return;
    }

    const now = this.clock.now();
    const view = await this.appointmentViews.findById(event.appointmentId);
    const branch = await this.branches.findById(event.current.branchId);
    const tenant = await this.tenants.findById(event.tenantId);
    const timezone = notificationTimezone(branch?.timezone, tenant?.timezone);
    const assignedProfessional = (
      await this.subscriptions.findEnabledByProfessional(
        event.current.professionalId,
      )
    ).some((subscription) => subscription.contactId === contact.id);
    const emergency =
      assignedProfessional &&
      (event.kind === AppointmentNotificationKind.CANCELLED ||
        event.kind === AppointmentNotificationKind.RESCHEDULED) &&
      isEmergencyWindow(event.current.startsAt, now);
    if (isQuietHour(now, timezone) && !emergency) {
      await this.deliveries.save(
        delivery.defer(nextQuietResumeAt(now, timezone)),
      );
      return;
    }

    const recent = await this.deliveries.findOpenForContactSince({
      contactId: contact.id,
      since: new Date(now.getTime() - NOTIFICATION_DIGEST_WINDOW_MS),
    });
    const isDigest = recent.length >= NOTIFICATION_DIGEST_THRESHOLD;

    const clientName = displayClientName(view?.client.name ?? null);
    const text = this.copy.renderAlert({
      eventId: event.id,
      kind: event.kind,
      clientDisplayName: clientName,
      serviceName: view?.service.name ?? 'Servicio',
      professionalName: view?.professional.name ?? 'Profesional',
      branchName: branch?.name ?? 'Sucursal',
      startsAtLabel: formatWallClock(event.current.startsAt, timezone),
      previousStartsAtLabel: event.previous
        ? formatWallClock(event.previous.startsAt, timezone)
        : null,
      isDigest,
      digestCount: recent.length,
    });

    const leased = await this.deliveries.tryMarkDispatching({
      id: delivery.id,
      renderedContent: text,
      leaseUntil: new Date(now.getTime() + 60_000),
      now,
    });
    if (!leased) return;

    try {
      const sent = await this.messaging.sendText({
        tenantId: event.tenantId,
        toE164: contact.phoneE164,
        text,
        typingDelayMs: notificationTypingDelayMs(event.id),
        outboundClass: OutboundClass.INTERNAL_NOTIFICATION,
      });
      await this.deliveries.save(
        leased.markAccepted({
          now: this.clock.now(),
          providerMessageId: sent.providerMessageId,
        }),
      );
    } catch (error) {
      if (
        error instanceof DomainException &&
        error.code === ErrorCode.OUTBOUND_DEFERRED
      ) {
        const retryAfterMs = Number(error.params.retryAfterMs ?? 15_000);
        await this.deliveries.save(
          leased.defer(new Date(this.clock.now().getTime() + retryAfterMs)),
        );
        return;
      }
      if (
        error instanceof DomainException &&
        error.code === ErrorCode.OUTBOUND_BLOCKED
      ) {
        await this.deliveries.save(
          leased.suppress({
            now: this.clock.now(),
            lastErrorCode: 'breaker_open',
          }),
        );
        return;
      }
      if (isWhatsApp463(error)) {
        await this.deliveries.save(
          leased.markFailed({
            now: this.clock.now(),
            lastErrorCode: 'whatsapp_463',
            lastError: error instanceof Error ? error.message : String(error),
          }),
        );
        return;
      }
      if (isAmbiguousProviderError(error)) {
        await this.deliveries.save(
          leased.markUnknown({
            now: this.clock.now(),
            lastError: error instanceof Error ? error.message : String(error),
          }),
        );
        return;
      }
      await this.deliveries.save(
        leased.markFailed({
          now: this.clock.now(),
          lastErrorCode:
            error instanceof DomainException ? error.code : 'send_failed',
          lastError: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}

function displayClientName(name: string | null): string {
  if (!name) return 'Clienta';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function formatWallClock(value: Date, timezone: string): string {
  return DateTime.fromJSDate(value, { zone: timezone })
    .setLocale('es-BO')
    .toFormat('ccc d LLL, HH:mm');
}

function notificationTypingDelayMs(eventId: string): number {
  let hash = 0;
  for (let i = 0; i < eventId.length; i += 1) {
    hash = (hash + eventId.charCodeAt(i) * (i + 1)) % 700;
  }
  return 800 + hash;
}

function isWhatsApp463(error: unknown): boolean {
  if (!(error instanceof DomainException)) return false;
  const status = Number(error.params.status ?? 0);
  const body = String(error.params.body ?? '');
  return status === 463 || /\b463\b/.test(body);
}

function isAmbiguousProviderError(error: unknown): boolean {
  if (!(error instanceof DomainException)) return false;
  const cause = String(error.params.cause ?? '');
  return /timeout|aborted|fetch failed/i.test(cause);
}
