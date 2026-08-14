import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import {
  CreatePlanData,
  PlanRepository,
  UpdatePlanData,
} from '@domain/subscriptions/repositories/plan.repository';
import { Plan } from '@domain/subscriptions/entities/plan.entity';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { PlanMapper } from '../drizzle/mappers/plan.mapper';
import { plans } from '../drizzle/schema';

@Injectable()
export class DrizzlePlanRepository implements PlanRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(data: CreatePlanData): Promise<Plan> {
    try {
      const [created] = await this.drizzle.db
        .insert(plans)
        .values({
          code: data.code,
          name: data.name,
          isActive: data.isActive ?? true,
          priceAmount: data.price.amount,
          priceCurrency: data.price.currency,
          billingPeriodMonths: data.billingPeriodMonths ?? 1,
          config: data.config ?? {},
        })
        .returning();

      return PlanMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findById(id: string): Promise<Plan | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);

    return row ? PlanMapper.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Plan | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(plans)
      .where(eq(plans.code, code))
      .limit(1);

    return row ? PlanMapper.toDomain(row) : null;
  }

  async findAll(options?: { activeOnly?: boolean }): Promise<Plan[]> {
    const rows = options?.activeOnly
      ? await this.drizzle.db
          .select()
          .from(plans)
          .where(eq(plans.isActive, true))
      : await this.drizzle.db.select().from(plans);

    return rows.map(PlanMapper.toDomain);
  }

  async update(id: string, data: UpdatePlanData): Promise<Plan | null> {
    try {
      const [updated] = await this.drizzle.db
        .update(plans)
        .set({
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.price !== undefined
            ? {
                priceAmount: data.price.amount,
                priceCurrency: data.price.currency,
              }
            : {}),
          ...(data.billingPeriodMonths !== undefined
            ? { billingPeriodMonths: data.billingPeriodMonths }
            : {}),
          ...(data.config !== undefined ? { config: data.config } : {}),
        })
        .where(eq(plans.id, id))
        .returning();

      return updated ? PlanMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAll(): Promise<void> {
    await this.drizzle.db.delete(plans);
  }
}
