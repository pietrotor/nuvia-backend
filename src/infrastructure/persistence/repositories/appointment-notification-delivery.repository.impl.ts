import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';

import { AppointmentNotificationDelivery } from '@domain/appointment-notifications/entities/appointment-notification-delivery.entity';
import {
  AppointmentNotificationDeliveryRepository,
  CreateAppointmentNotificationDeliveryData,
} from '@domain/appointment-notifications/repositories/appointment-notification-delivery.repository';
import { NOTIFICATION_DISPATCH_PER_TENANT_CAP } from '@domain/appointment-notifications/services/notification-limits';
import { AppointmentNotificationDeliveryStatus } from '@domain/appointment-notifications/value-objects/appointment-notification-delivery-status.vo';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { AppointmentNotificationDeliveryMapper } from '../drizzle/mappers/appointment-notification-delivery.mapper';
import { appointmentNotificationDeliveries } from '../drizzle/schema/appointment-notification.schema';
import { TenantScopedRepository } from './tenant-scoped.repository';
import { tenantFairnessRankSql } from './tenant-fairness-rank.sql';

const OPEN_STATUSES = [
  AppointmentNotificationDeliveryStatus.PENDING,
  AppointmentNotificationDeliveryStatus.DEFERRED,
  AppointmentNotificationDeliveryStatus.DISPATCHING,
];

@Injectable()
export class DrizzleAppointmentNotificationDeliveryRepository
  extends TenantScopedRepository
  implements AppointmentNotificationDeliveryRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async createMany(
    rows: CreateAppointmentNotificationDeliveryData[],
  ): Promise<AppointmentNotificationDelivery[]> {
    if (rows.length === 0) return [];
    try {
      const tenantId = this.tenantId;
      const inserted = await this.drizzle.db
        .insert(appointmentNotificationDeliveries)
        .values(
          rows.map((row) => ({
            tenantId,
            eventId: row.eventId,
            contactId: row.contactId,
            destinationPhoneE164: row.destinationPhoneE164,
            status: AppointmentNotificationDeliveryStatus.PENDING,
            nextAttemptAt: row.nextAttemptAt,
          })),
        )
        .onConflictDoNothing()
        .returning();
      return inserted.map(AppointmentNotificationDeliveryMapper.toDomain);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async save(
    delivery: AppointmentNotificationDelivery,
  ): Promise<AppointmentNotificationDelivery> {
    const [row] = await this.updateIn(
      appointmentNotificationDeliveries,
      {
        renderedContent: delivery.renderedContent,
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        nextAttemptAt: delivery.nextAttemptAt,
        leaseUntil: delivery.leaseUntil,
        providerMessageId: delivery.providerMessageId,
        acceptedAt: delivery.acceptedAt,
        deliveredAt: delivery.deliveredAt,
        failedAt: delivery.failedAt,
        lastErrorCode: delivery.lastErrorCode,
        lastError: delivery.lastError,
      },
      eq(appointmentNotificationDeliveries.id, delivery.id),
    );
    return AppointmentNotificationDeliveryMapper.toDomain(row);
  }

  async tryMarkDispatching(input: {
    id: string;
    renderedContent: string;
    leaseUntil: Date;
    now: Date;
  }): Promise<AppointmentNotificationDelivery | null> {
    const [row] = await this.drizzle.db
      .update(appointmentNotificationDeliveries)
      .set({
        renderedContent: input.renderedContent,
        status: AppointmentNotificationDeliveryStatus.DISPATCHING,
        leaseUntil: input.leaseUntil,
        attemptCount: sql`${appointmentNotificationDeliveries.attemptCount} + 1`,
      })
      .where(
        this.scope(
          appointmentNotificationDeliveries,
          eq(appointmentNotificationDeliveries.id, input.id),
          or(
            inArray(appointmentNotificationDeliveries.status, [
              AppointmentNotificationDeliveryStatus.PENDING,
              AppointmentNotificationDeliveryStatus.DEFERRED,
            ]),
            and(
              eq(
                appointmentNotificationDeliveries.status,
                AppointmentNotificationDeliveryStatus.DISPATCHING,
              ),
              lte(appointmentNotificationDeliveries.leaseUntil, input.now),
            ),
          ),
        ),
      )
      .returning();
    return row ? AppointmentNotificationDeliveryMapper.toDomain(row) : null;
  }

  async findById(id: string): Promise<AppointmentNotificationDelivery | null> {
    const [row] = await this.selectFrom(
      appointmentNotificationDeliveries,
      eq(appointmentNotificationDeliveries.id, id),
    );
    return row ? AppointmentNotificationDeliveryMapper.toDomain(row) : null;
  }

  async findByEventAndContact(input: {
    eventId: string;
    contactId: string;
  }): Promise<AppointmentNotificationDelivery | null> {
    const [row] = await this.selectFrom(
      appointmentNotificationDeliveries,
      and(
        eq(appointmentNotificationDeliveries.eventId, input.eventId),
        eq(appointmentNotificationDeliveries.contactId, input.contactId),
      ),
    );
    return row ? AppointmentNotificationDeliveryMapper.toDomain(row) : null;
  }

  async findByProviderMessageId(
    providerMessageId: string,
  ): Promise<AppointmentNotificationDelivery | null> {
    const [row] = await this.selectFrom(
      appointmentNotificationDeliveries,
      eq(
        appointmentNotificationDeliveries.providerMessageId,
        providerMessageId,
      ),
    );
    return row ? AppointmentNotificationDeliveryMapper.toDomain(row) : null;
  }

  async claimDue(
    now: Date,
    limit: number,
  ): Promise<AppointmentNotificationDelivery[]> {
    const rows = await this.drizzle.db
      .select()
      .from(appointmentNotificationDeliveries)
      .where(
        this.scope(
          appointmentNotificationDeliveries,
          dueDeliveryCondition(now),
        ),
      )
      .orderBy(appointmentNotificationDeliveries.nextAttemptAt)
      .limit(limit);
    return rows.map(AppointmentNotificationDeliveryMapper.toDomain);
  }

  async claimDueUnscoped(
    now: Date,
    limit: number,
  ): Promise<AppointmentNotificationDelivery[]> {
    const expired = await this.selectInterleavedUnscoped(
      limit,
      expiredDispatchingCondition(now),
    );
    const pending = await this.selectInterleavedUnscoped(
      limit,
      pendingOrDeferredDueCondition(now),
    );
    const seen = new Set<string>();
    const merged: AppointmentNotificationDelivery[] = [];
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
  ): Promise<AppointmentNotificationDelivery[]> {
    const table = appointmentNotificationDeliveries;
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
        AppointmentNotificationDeliveryMapper.toDomain(row),
      ]),
    );
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  }

  async findOpenForContactSince(input: {
    contactId: string;
    since: Date;
  }): Promise<AppointmentNotificationDelivery[]> {
    const rows = await this.selectFrom(
      appointmentNotificationDeliveries,
      and(
        eq(appointmentNotificationDeliveries.contactId, input.contactId),
        inArray(appointmentNotificationDeliveries.status, OPEN_STATUSES),
        gte(appointmentNotificationDeliveries.createdAt, input.since),
      ),
    );
    return rows.map(AppointmentNotificationDeliveryMapper.toDomain);
  }

  async findLatestForContact(
    contactId: string,
  ): Promise<AppointmentNotificationDelivery | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(appointmentNotificationDeliveries)
      .where(
        this.scope(
          appointmentNotificationDeliveries,
          eq(appointmentNotificationDeliveries.contactId, contactId),
        ),
      )
      .orderBy(desc(appointmentNotificationDeliveries.createdAt))
      .limit(1);
    return row ? AppointmentNotificationDeliveryMapper.toDomain(row) : null;
  }

  async cancelOpenForContact(contactId: string, now: Date): Promise<number> {
    const updated = await this.updateIn(
      appointmentNotificationDeliveries,
      {
        status: AppointmentNotificationDeliveryStatus.SUPPRESSED,
        failedAt: now,
        lastErrorCode: 'contact_deactivated',
        leaseUntil: null,
      },
      and(
        eq(appointmentNotificationDeliveries.contactId, contactId),
        inArray(appointmentNotificationDeliveries.status, OPEN_STATUSES),
      ),
    );
    return updated.length;
  }
}

function dueDeliveryCondition(now: Date) {
  return or(
    pendingOrDeferredDueCondition(now),
    expiredDispatchingCondition(now),
  );
}

export function pendingOrDeferredDueCondition(now: Date) {
  return and(
    inArray(appointmentNotificationDeliveries.status, [
      AppointmentNotificationDeliveryStatus.PENDING,
      AppointmentNotificationDeliveryStatus.DEFERRED,
    ]),
    lte(appointmentNotificationDeliveries.nextAttemptAt, now),
  );
}

export function expiredDispatchingCondition(now: Date) {
  return and(
    eq(
      appointmentNotificationDeliveries.status,
      AppointmentNotificationDeliveryStatus.DISPATCHING,
    ),
    lte(appointmentNotificationDeliveries.leaseUntil, now),
  );
}
