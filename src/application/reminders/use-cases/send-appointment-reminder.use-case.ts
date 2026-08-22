import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import {
  APPOINTMENT_VIEW_REPOSITORY,
  AppointmentViewRepository,
} from '@domain/appointments/repositories/appointment-view.repository';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { DomainException, ErrorCode } from '@domain/common/exceptions';
import {
  MESSAGING_PORT,
  MessagingPort,
  OutboundClass,
} from '@domain/messaging/ports/messaging.port';
import {
  CLIENT_REMINDER_COPY_PORT,
  ClientReminderCopyPort,
} from '@domain/reminders/ports/client-reminder-copy.port';
import {
  APPOINTMENT_REMINDER_REPOSITORY,
  AppointmentReminderRepository,
} from '@domain/reminders/repositories/appointment-reminder.repository';
import { FALLBACK_REMINDER_TIMEZONE } from '@domain/reminders/services/reminder-limits';
import { AppointmentReminderKind } from '@domain/reminders/value-objects/appointment-reminder-kind.vo';
import { PlanEntitlements } from '@application/subscriptions/services/plan-entitlements.service';
import { PlanFeature } from '@domain/subscriptions/value-objects/plan-config.vo';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';

@Injectable()
export class SendAppointmentReminderUseCase {
  constructor(
    @Inject(APPOINTMENT_REMINDER_REPOSITORY)
    private readonly reminders: AppointmentReminderRepository,
    @Inject(APPOINTMENT_VIEW_REPOSITORY)
    private readonly appointmentViews: AppointmentViewRepository,
    @Inject(BRANCH_REPOSITORY)
    private readonly branches: BranchRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenants: TenantRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigs: BusinessConfigRepository,
    @Inject(CLIENT_REMINDER_COPY_PORT)
    private readonly copy: ClientReminderCopyPort,
    @Inject(MESSAGING_PORT)
    private readonly messaging: MessagingPort,
    private readonly entitlements: PlanEntitlements,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(reminderId: string): Promise<void> {
    const reminder = await this.reminders.findById(reminderId);
    if (!reminder || !reminder.isOpen()) return;

    const now = this.clock.now();
    const plan = await this.entitlements.effectiveConfig();
    if (!plan.features[PlanFeature.REMINDERS]) {
      await this.reminders.save(
        reminder.suppress({ now, lastErrorCode: 'plan_feature' }),
      );
      return;
    }

    const config = await this.businessConfigs.findByTenant();
    if (!config?.clientReminderPolicy.enabled) {
      await this.reminders.save(
        reminder.suppress({ now, lastErrorCode: 'policy_disabled' }),
      );
      return;
    }

    const view = await this.appointmentViews.findById(reminder.appointmentId);
    if (!view) {
      await this.reminders.save(
        reminder.suppress({ now, lastErrorCode: 'missing_appointment' }),
      );
      return;
    }

    if (!this.isStillDue(reminder.kind, view.appointment.status)) {
      await this.reminders.save(
        reminder.suppress({ now, lastErrorCode: 'appointment_status' }),
      );
      return;
    }

    if (
      reminder.kind !== AppointmentReminderKind.THANK_YOU &&
      view.appointment.startsAt.getTime() <= now.getTime()
    ) {
      await this.reminders.save(
        reminder.suppress({ now, lastErrorCode: 'appointment_started' }),
      );
      return;
    }

    const [branch, tenant] = await Promise.all([
      this.branches.findById(view.appointment.branchId),
      this.tenants.findById(reminder.tenantId),
    ]);
    const timezone =
      branch?.timezone ?? tenant?.timezone ?? FALLBACK_REMINDER_TIMEZONE;
    const text = this.copy.render({
      reminderId: reminder.id,
      kind: reminder.kind,
      agentName: config.agentName,
      serviceName: view.service.name,
      professionalName: view.professional.name,
      branchName: branch?.name ?? 'Sucursal',
      startsAtLabel: formatWallClock(view.appointment.startsAt, timezone),
      depositPending:
        view.appointment.status === AppointmentStatus.PENDING_DEPOSIT,
    });

    const leased = await this.reminders.tryMarkDispatching({
      id: reminder.id,
      renderedContent: text,
      leaseUntil: new Date(now.getTime() + 60_000),
      now,
    });
    if (!leased) return;

    const latestView = await this.appointmentViews.findById(
      reminder.appointmentId,
    );
    if (
      !latestView ||
      !this.isStillDue(reminder.kind, latestView.appointment.status)
    ) {
      await this.reminders.save(
        leased.suppress({
          now: this.clock.now(),
          lastErrorCode: 'appointment_status_after_lease',
        }),
      );
      return;
    }
    const latestText = this.copy.render({
      reminderId: reminder.id,
      kind: reminder.kind,
      agentName: config.agentName,
      serviceName: latestView.service.name,
      professionalName: latestView.professional.name,
      branchName: branch?.name ?? 'Sucursal',
      startsAtLabel: formatWallClock(latestView.appointment.startsAt, timezone),
      depositPending:
        latestView.appointment.status === AppointmentStatus.PENDING_DEPOSIT,
    });
    const delivery = leased.withContent(latestText);

    try {
      const sent = await this.messaging.sendText({
        tenantId: reminder.tenantId,
        toE164: reminder.destinationPhoneE164,
        text: latestText,
        typingDelayMs: reminderTypingDelayMs(reminder.id),
        outboundClass: OutboundClass.TRANSACTIONAL,
      });
      await this.reminders.save(
        delivery.markAccepted({
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
        await this.reminders.save(
          delivery.defer(new Date(this.clock.now().getTime() + retryAfterMs)),
        );
        return;
      }
      if (
        error instanceof DomainException &&
        error.code === ErrorCode.OUTBOUND_BLOCKED
      ) {
        await this.reminders.save(
          delivery.suppress({
            now: this.clock.now(),
            lastErrorCode: 'breaker_open',
          }),
        );
        return;
      }
      if (isWhatsApp463(error)) {
        await this.reminders.save(
          delivery.markFailed({
            now: this.clock.now(),
            lastErrorCode: 'whatsapp_463',
            lastError: error instanceof Error ? error.message : String(error),
          }),
        );
        return;
      }
      if (isAmbiguousProviderError(error)) {
        await this.reminders.save(
          delivery.markUnknown({
            now: this.clock.now(),
            lastError: error instanceof Error ? error.message : String(error),
          }),
        );
        return;
      }
      await this.reminders.save(
        delivery.markFailed({
          now: this.clock.now(),
          lastErrorCode:
            error instanceof DomainException ? error.code : 'send_failed',
          lastError: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private isStillDue(
    kind: AppointmentReminderKind,
    status: AppointmentStatus,
  ): boolean {
    if (kind === AppointmentReminderKind.THANK_YOU) {
      return status === AppointmentStatus.ATTENDED;
    }
    return (
      status === AppointmentStatus.CONFIRMED ||
      status === AppointmentStatus.PENDING_DEPOSIT
    );
  }
}

function formatWallClock(value: Date, timezone: string): string {
  return DateTime.fromJSDate(value, { zone: timezone })
    .setLocale('es-BO')
    .toFormat('ccc d LLL, HH:mm');
}

function reminderTypingDelayMs(reminderId: string): number {
  let hash = 0;
  for (let i = 0; i < reminderId.length; i += 1) {
    hash = (hash + reminderId.charCodeAt(i) * (i + 1)) % 700;
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
