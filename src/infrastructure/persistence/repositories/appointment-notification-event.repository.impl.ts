import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';

import { AppointmentNotificationEvent } from '@domain/appointment-notifications/entities/appointment-notification-event.entity';
import {
  AppointmentNotificationEventRepository,
  CreateAppointmentNotificationEventData,
} from '@domain/appointment-notifications/repositories/appointment-notification-event.repository';
import { NOTIFICATION_DISPATCH_PER_TENANT_CAP } from '@domain/appointment-notifications/services/notification-limits';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { AppointmentNotificationEventMapper } from '../drizzle/mappers/appointment-notification-event.mapper';
import { appointmentNotificationEvents } from '../drizzle/schema/appointment-notification.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';
import { tenantFairnessRankSql } from './tenant-fairness-rank.sql';

@Injectable()
export class DrizzleAppointmentNotificationEventRepository
  extends TenantScopedRepository
  implements AppointmentNotificationEventRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(
    data: CreateAppointmentNotificationEventData,
  ): Promise<AppointmentNotificationEvent> {
    try {
      const tenantId = this.tenantId;
      const [row] = await this.drizzle.db
        .insert(appointmentNotificationEvents)
        .values({
          tenantId,
          appointmentId: data.appointmentId,
          sequence: sql`(
            select coalesce(max(${appointmentNotificationEvents.sequence}), 0) + 1
            from ${appointmentNotificationEvents}
            where ${appointmentNotificationEvents.tenantId} = ${tenantId}
              and ${appointmentNotificationEvents.appointmentId} = ${data.appointmentId}
          )`,
          kind: data.kind,
          previousProfessionalId: data.previous?.professionalId ?? null,
          previousBranchId: data.previous?.branchId ?? null,
          previousStartsAt: data.previous?.startsAt ?? null,
          previousEndsAt: data.previous?.endsAt ?? null,
          currentProfessionalId: data.current.professionalId,
          currentBranchId: data.current.branchId,
          currentStartsAt: data.current.startsAt,
          currentEndsAt: data.current.endsAt,
          occurredAt: data.occurredAt,
          nextAttemptAt: data.nextAttemptAt,
        })
        .returning();
      return AppointmentNotificationEventMapper.toDomain(row);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async save(
    event: AppointmentNotificationEvent,
  ): Promise<AppointmentNotificationEvent> {
    const [row] = await this.updateIn(
      appointmentNotificationEvents,
      {
        expandedAt: event.expandedAt,
        attemptCount: event.attemptCount,
        nextAttemptAt: event.nextAttemptAt,
        lastError: event.lastError,
      },
      eq(appointmentNotificationEvents.id, event.id),
    );
    return AppointmentNotificationEventMapper.toDomain(row);
  }

  async findById(id: string): Promise<AppointmentNotificationEvent | null> {
    const [row] = await this.selectFrom(
      appointmentNotificationEvents,
      eq(appointmentNotificationEvents.id, id),
    );
    return row ? AppointmentNotificationEventMapper.toDomain(row) : null;
  }

  async findUnexpandedDue(
    now: Date,
    limit: number,
  ): Promise<AppointmentNotificationEvent[]> {
    const rows = await this.drizzle.db
      .select()
      .from(appointmentNotificationEvents)
      .where(
        this.scope(
          appointmentNotificationEvents,
          isNull(appointmentNotificationEvents.expandedAt),
          lte(appointmentNotificationEvents.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(appointmentNotificationEvents.nextAttemptAt))
      .limit(limit);
    return rows.map(AppointmentNotificationEventMapper.toDomain);
  }

  async findUnexpandedDueUnscoped(
    now: Date,
    limit: number,
  ): Promise<AppointmentNotificationEvent[]> {
    const table = appointmentNotificationEvents;
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
      .where(and(isNull(table.expandedAt), lte(table.nextAttemptAt, now)))
      .as('ranked');

    const idRows = await this.drizzle.db
      .select({ id: ranked.id })
      .from(ranked)
      .where(sql`${ranked.rn} <= ${NOTIFICATION_DISPATCH_PER_TENANT_CAP}`)
      .orderBy(asc(ranked.nextAttemptAt), asc(ranked.id))
      .limit(limit);
    if (idRows.length === 0) return [];

    const ids = idRows.map((row) => row.id);
    const rows = await this.drizzle.db
      .select()
      .from(table)
      .where(inArray(table.id, ids));
    const byId = new Map(
      rows.map((row) => [
        row.id,
        AppointmentNotificationEventMapper.toDomain(row),
      ]),
    );
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }

  async findLaterForAppointment(input: {
    appointmentId: string;
    afterSequence: number;
  }): Promise<AppointmentNotificationEvent[]> {
    const rows = await this.selectFrom(
      appointmentNotificationEvents,
      and(
        eq(appointmentNotificationEvents.appointmentId, input.appointmentId),
        gt(appointmentNotificationEvents.sequence, input.afterSequence),
      ),
    );
    return rows.map(AppointmentNotificationEventMapper.toDomain);
  }
}
