import { Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';

import { Subscription } from '@domain/subscriptions/entities/subscription.entity';
import {
  CreateSubscriptionData,
  SubscriptionRepository,
  UpdateSubscriptionData,
} from '@domain/subscriptions/repositories/subscription.repository';
import { SubscriptionStatus } from '@domain/subscriptions/value-objects/subscription-status.vo';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { SubscriptionMapper } from '../drizzle/mappers/subscription.mapper';
import { plans, subscriptions } from '../drizzle/schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleSubscriptionRepository
  extends TenantScopedRepository
  implements SubscriptionRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateSubscriptionData): Promise<Subscription> {
    try {
      const [created] = await this.insertInto(subscriptions, {
        planId: data.planId,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        configOverrides: data.configOverrides ?? null,
        priceAmount: data.price.amount,
        priceCurrency: data.price.currency,
        notes: data.notes ?? null,
      });

      return SubscriptionMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findCurrent(): Promise<Subscription | null> {
    const [row] = await this.selectFrom(
      subscriptions,
      ne(subscriptions.status, SubscriptionStatus.CANCELLED),
    );
    return row ? SubscriptionMapper.toDomain(row) : null;
  }

  async findCurrentByTenantIdUnscoped(
    tenantId: string,
  ): Promise<Subscription | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          ne(subscriptions.status, SubscriptionStatus.CANCELLED),
        ),
      )
      .limit(1);

    return row ? SubscriptionMapper.toDomain(row) : null;
  }

  async findCurrentWithPlan(): Promise<Subscription | null> {
    const [row] = await this.drizzle.db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.tenantId, this.tenantId),
          ne(subscriptions.status, SubscriptionStatus.CANCELLED),
        ),
      )
      .limit(1);

    return row ? SubscriptionMapper.toDomain(row.subscription, row.plan) : null;
  }

  async findCurrentWithPlanByTenantIdUnscoped(
    tenantId: string,
  ): Promise<Subscription | null> {
    const [row] = await this.drizzle.db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.tenantId, tenantId),
          ne(subscriptions.status, SubscriptionStatus.CANCELLED),
        ),
      )
      .limit(1);

    return row ? SubscriptionMapper.toDomain(row.subscription, row.plan) : null;
  }

  async update(
    id: string,
    data: UpdateSubscriptionData,
  ): Promise<Subscription | null> {
    try {
      const [updated] = await this.updateIn(
        subscriptions,
        {
          ...(data.planId !== undefined ? { planId: data.planId } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.currentPeriodStart !== undefined
            ? { currentPeriodStart: data.currentPeriodStart }
            : {}),
          ...(data.currentPeriodEnd !== undefined
            ? { currentPeriodEnd: data.currentPeriodEnd }
            : {}),
          ...(data.configOverrides !== undefined
            ? { configOverrides: data.configOverrides }
            : {}),
          ...(data.price !== undefined
            ? {
                priceAmount: data.price.amount,
                priceCurrency: data.price.currency,
              }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.cancelledAt !== undefined
            ? { cancelledAt: data.cancelledAt }
            : {}),
        },
        eq(subscriptions.id, id),
      );

      return updated ? SubscriptionMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(subscriptions);
  }
}
