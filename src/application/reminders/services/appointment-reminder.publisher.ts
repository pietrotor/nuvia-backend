import { Inject, Injectable } from '@nestjs/common';

import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import {
  CLIENT_REMINDER_OFFSET_MS,
  CLIENT_REMINDER_THANK_YOU_DELAY_MS,
  ClientReminderOffset,
} from '@domain/business-config/value-objects/client-reminder-policy.vo';
import {
  CLIENT_REPOSITORY,
  ClientRepository,
} from '@domain/clients/repositories/client.repository';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  APPOINTMENT_REMINDER_REPOSITORY,
  AppointmentReminderRepository,
} from '@domain/reminders/repositories/appointment-reminder.repository';
import {
  AppointmentReminderKind,
  PRE_VISIT_REMINDER_KINDS,
} from '@domain/reminders/value-objects/appointment-reminder-kind.vo';
import { PlanEntitlements } from '@application/subscriptions/services/plan-entitlements.service';
import { PlanFeature } from '@domain/subscriptions/value-objects/plan-config.vo';

@Injectable()
export class AppointmentReminderPublisher {
  constructor(
    @Inject(APPOINTMENT_REMINDER_REPOSITORY)
    private readonly reminders: AppointmentReminderRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigs: BusinessConfigRepository,
    @Inject(CLIENT_REPOSITORY)
    private readonly clients: ClientRepository,
    private readonly entitlements: PlanEntitlements,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async syncPreVisit(appointment: Appointment): Promise<void> {
    if (
      appointment.status !== AppointmentStatus.CONFIRMED &&
      appointment.status !== AppointmentStatus.PENDING_DEPOSIT
    ) {
      return;
    }

    const context = await this.loadContext();
    if (!context) {
      await this.cancelPreVisit(appointment.id);
      return;
    }

    const phone = await this.contactPhone(appointment);
    if (!phone) {
      await this.cancelPreVisit(appointment.id);
      return;
    }

    const now = this.clock.now();
    const wanted = new Set<AppointmentReminderKind>();
    const rows: {
      appointmentId: string;
      kind: AppointmentReminderKind;
      destinationPhoneE164: string;
      nextAttemptAt: Date;
    }[] = [];

    for (const offset of context.offsets) {
      const fireAt = new Date(
        appointment.startsAt.getTime() - CLIENT_REMINDER_OFFSET_MS[offset],
      );
      if (fireAt.getTime() <= now.getTime()) continue;
      const kind = offset as AppointmentReminderKind;
      wanted.add(kind);
      rows.push({
        appointmentId: appointment.id,
        kind,
        destinationPhoneE164: phone,
        nextAttemptAt: fireAt,
      });
    }

    const stale = PRE_VISIT_REMINDER_KINDS.filter((kind) => !wanted.has(kind));
    if (stale.length > 0) {
      await this.reminders.cancelOpen({
        appointmentId: appointment.id,
        kinds: stale,
        now,
      });
    }
    await this.reminders.upsertMany(rows);
  }

  async cancelOpen(appointmentId: string): Promise<void> {
    await this.reminders.cancelOpen({
      appointmentId,
      now: this.clock.now(),
    });
  }

  async recordAttended(appointment: Appointment): Promise<void> {
    const now = this.clock.now();
    await this.reminders.cancelOpen({
      appointmentId: appointment.id,
      kinds: PRE_VISIT_REMINDER_KINDS,
      now,
    });

    const context = await this.loadContext();
    if (!context?.thankYouAfterVisit) return;

    const phone = await this.contactPhone(appointment);
    if (!phone) return;

    await this.reminders.upsertMany([
      {
        appointmentId: appointment.id,
        kind: AppointmentReminderKind.THANK_YOU,
        destinationPhoneE164: phone,
        nextAttemptAt: new Date(
          now.getTime() + CLIENT_REMINDER_THANK_YOU_DELAY_MS,
        ),
      },
    ]);
  }

  private async loadContext(): Promise<{
    offsets: ClientReminderOffset[];
    thankYouAfterVisit: boolean;
  } | null> {
    const plan = await this.entitlements.effectiveConfig();
    if (!plan.features[PlanFeature.REMINDERS]) return null;

    const config = await this.businessConfigs.findByTenant();
    if (!config?.clientReminderPolicy.enabled) return null;

    return {
      offsets: config.clientReminderPolicy.offsets,
      thankYouAfterVisit: config.clientReminderPolicy.thankYouAfterVisit,
    };
  }

  private async contactPhone(appointment: Appointment): Promise<string | null> {
    const client = await this.clients.findById(
      appointment.bookingContactClientId,
    );
    return client?.phoneE164 ?? null;
  }

  private cancelPreVisit(appointmentId: string): Promise<number> {
    return this.reminders.cancelOpen({
      appointmentId,
      kinds: PRE_VISIT_REMINDER_KINDS,
      now: this.clock.now(),
    });
  }
}
