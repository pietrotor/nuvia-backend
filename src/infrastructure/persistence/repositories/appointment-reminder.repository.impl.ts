import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, lte, or, sql } from 'drizzle-orm';

import { AppointmentReminder } from '@domain/reminders/entities/appointment-reminder.entity';
import {
  AppointmentReminderRepository,
  UpsertAppointmentReminderData,
} from '@domain/reminders/repositories/appointment-reminder.repository';
import { REMINDER_DISPATCH_PER_TENANT_CAP } from '@domain/reminders/services/reminder-limits';
import { AppointmentReminderKind } from '@domain/reminders/value-objects/appointment-reminder-kind.vo';
import { AppointmentReminderStatus } from '@domain/reminders/value-objects/appointment-reminder-status.vo';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { AppointmentReminderMapper } from '../drizzle/mappers/appointment-reminder.mapper';
import { appointmentReminders } from '../drizzle/schema/appointment-reminder.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';
import { tenantFairnessRankSql } from './tenant-fairness-rank.sql';

const OPEN_STATUSES = [
  AppointmentReminderStatus.PENDING,
  AppointmentReminderStatus.DEFERRED,
  AppointmentReminderStatus.DISPATCHING,
];

@Injectable()
export class DrizzleAppointmentReminderRepository
  extends TenantScopedRepository
  implements AppointmentReminderRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async upsertMany(rows: UpsertAppointmentReminderData[]): Promise<void> {
    if (rows.length === 0) return;
    try {
      const tenantId = this.tenantId;
      await this.drizzle.db
        .insert(appointmentReminders)
        .values(
          rows.map((row) => ({
            tenantId,
            appointmentId: row.appointmentId,
            kind: row.kind,
            destinationPhoneE164: row.destinationPhoneE164,
            status: AppointmentReminderStatus.PENDING,
            attemptCount: 0,
            nextAttemptAt: row.nextAttemptAt,
            leaseUntil: null,
            renderedContent: null,
            providerMessageId: null,
            acceptedAt: null,
            failedAt: null,
            lastErrorCode: null,
            lastError: null,
          })),
        )
        .onConflictDoUpdate({
          target: [
            appointmentReminders.tenantId,
            appointmentReminders.appointmentId,
            appointmentReminders.kind,
          ],
          set: {
            destinationPhoneE164: sql`excluded.destination_phone_e164`,
            status: AppointmentReminderStatus.PENDING,
            attemptCount: 0,
            nextAttemptAt: sql`excluded.next_attempt_at`,
            leaseUntil: null,
            renderedContent: null,
            providerMessageId: null,
            acceptedAt: null,
            failedAt: null,
            lastErrorCode: null,
            lastError: null,
            updatedAt: new Date(),
          },
        });
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async cancelOpen(input: {
    appointmentId: string;
    kinds?: AppointmentReminderKind[];
    now: Date;
  }): Promise<number> {
    const kindFilter = input.kinds
      ? inArray(appointmentReminders.kind, input.kinds)
      : undefined;
    const updated = await this.updateIn(
      appointmentReminders,
      {
        status: AppointmentReminderStatus.CANCELLED,
        leaseUntil: null,
        failedAt: input.now,
        lastErrorCode: 'cancelled',
      },
      and(
        eq(appointmentReminders.appointmentId, input.appointmentId),
        inArray(appointmentReminders.status, OPEN_STATUSES),
        kindFilter,
      ),
    );
    return updated.length;
  }

  async save(reminder: AppointmentReminder): Promise<AppointmentReminder> {
    const [row] = await this.updateIn(
      appointmentReminders,
      {
        renderedContent: reminder.renderedContent,
        status: reminder.status,
        attemptCount: reminder.attemptCount,
        nextAttemptAt: reminder.nextAttemptAt,
        leaseUntil: reminder.leaseUntil,
        providerMessageId: reminder.providerMessageId,
        acceptedAt: reminder.acceptedAt,
        failedAt: reminder.failedAt,
        lastErrorCode: reminder.lastErrorCode,
        lastError: reminder.lastError,
      },
      eq(appointmentReminders.id, reminder.id),
    );
    return AppointmentReminderMapper.toDomain(row);
  }

  async tryMarkDispatching(input: {
    id: string;
    renderedContent: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<AppointmentReminder | null> {
    const [row] = await this.drizzle.db
      .update(appointmentReminders)
      .set({
        renderedContent: input.renderedContent,
        status: AppointmentReminderStatus.DISPATCHING,
        leaseUntil: input.leaseUntil,
        attemptCount: sql`${appointmentReminders.attemptCount} + 1`,
      })
      .where(
        this.scope(
          appointmentReminders,
          eq(appointmentReminders.id, input.id),
          or(
            inArray(appointmentReminders.status, [
              AppointmentReminderStatus.PENDING,
              AppointmentReminderStatus.DEFERRED,
            ]),
            and(
              eq(
                appointmentReminders.status,
                AppointmentReminderStatus.DISPATCHING,
              ),
              lte(appointmentReminders.leaseUntil, input.now),
            ),
          ),
        ),
      )
      .returning();
    return row ? AppointmentReminderMapper.toDomain(row) : null;
  }

  async findById(id: string): Promise<AppointmentReminder | null> {
    const [row] = await this.selectFrom(
      appointmentReminders,
      eq(appointmentReminders.id, id),
    );
    return row ? AppointmentReminderMapper.toDomain(row) : null;
  }

  async findByAppointmentAndKind(input: {
    appointmentId: string;
    kind: AppointmentReminderKind;
  }): Promise<AppointmentReminder | null> {
    const [row] = await this.selectFrom(
      appointmentReminders,
      and(
        eq(appointmentReminders.appointmentId, input.appointmentId),
        eq(appointmentReminders.kind, input.kind),
      ),
    );
    return row ? AppointmentReminderMapper.toDomain(row) : null;
  }

  async claimDueUnscoped(
    now: Date,
    limit: number,
  ): Promise<AppointmentReminder[]> {
    const expired = await this.selectInterleavedUnscoped(
      limit,
      expiredDispatchingCondition(now),
    );
    const pending = await this.selectInterleavedUnscoped(
      limit,
      pendingOrDeferredDueCondition(now),
    );
    const seen = new Set<string>();
    const merged: AppointmentReminder[] = [];
    for (const row of [...expired, ...pending]) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
      if (merged.length >= limit) break;
    }
    return merged;
  }

  private async selectInterleavedUnscoped(
    limit: number,
    dueCondition: ReturnType<typeof pendingOrDeferredDueCondition>,
  ): Promise<AppointmentReminder[]> {
    const table = appointmentReminders;
    const ranked = this.drizzle.db
      .select({
        id: table.id,
        nextAttemptAt: table.nextAttemptAt,
        rn: tenantFairnessRankSql(
          table.tenantId,
          table.nextAttemptAt,
          table.id,
        ).as('rn'),
      })
      .from(table)
      .where(dueCondition)
      .as('ranked');

    const idRows = await this.drizzle.db
      .select({ id: ranked.id })
      .from(ranked)
      .where(sql`${ranked.rn} <= ${REMINDER_DISPATCH_PER_TENANT_CAP}`)
      .orderBy(asc(ranked.nextAttemptAt), asc(ranked.id))
      .limit(limit);
    if (idRows.length === 0) return [];

    const ids = idRows.map((row) => row.id);
    const rows = await this.drizzle.db
      .select()
      .from(table)
      .where(inArray(table.id, ids));
    const byId = new Map(
      rows.map((row) => [row.id, AppointmentReminderMapper.toDomain(row)]),
    );
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }
}

function pendingOrDeferredDueCondition(now: Date) {
  return and(
    inArray(appointmentReminders.status, [
      AppointmentReminderStatus.PENDING,
      AppointmentReminderStatus.DEFERRED,
    ]),
    lte(appointmentReminders.nextAttemptAt, now),
  );
}

function expiredDispatchingCondition(now: Date) {
  return and(
    eq(appointmentReminders.status, AppointmentReminderStatus.DISPATCHING),
    lte(appointmentReminders.leaseUntil, now),
  );
}
