import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import {
  BusinessConfigRepository,
  CreateBusinessConfigData,
  UpdateBusinessConfigData,
} from '@domain/business-config/repositories/business-config.repository';
import {
  AgentTone,
  BusinessConfig,
  DEFAULT_AGENT_POLICY,
} from '@domain/business-config/entities/business-config.entity';
import { DEFAULT_BUSINESS_CATEGORY } from '@domain/business-config/value-objects/business-category.vo';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';
import { DatabaseErrorTranslator } from '@infrastructure/errors/database-error.translator';

import { DrizzleService } from '../drizzle/drizzle.service';
import { businessConfigs } from '../drizzle/schema/business-config.schema';
import { BusinessConfigMapper } from '../drizzle/mappers/business-config.mapper';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzleBusinessConfigRepository
  extends TenantScopedRepository
  implements BusinessConfigRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async create(data: CreateBusinessConfigData): Promise<BusinessConfig> {
    try {
      const [created] = await this.insertInto(businessConfigs, {
        slug: data.slug,
        agentName: data.agentName ?? 'Vale',
        tone: data.tone ?? AgentTone.WARM,
        businessCategory: data.businessCategory ?? DEFAULT_BUSINESS_CATEGORY,
        currency: data.currency ?? Currency.BOB,
        logoUrl: data.logoUrl,
        whatsappPhone: data.whatsappPhone,
        bookingPolicy: data.bookingPolicy,
        agentPolicy: data.agentPolicy ?? DEFAULT_AGENT_POLICY,
        faq: data.faq ?? {},
        evolutionInstanceId: data.evolutionInstanceId,
        evolutionInstanceName: data.evolutionInstanceName,
        evolutionWebhookTokenHash: data.evolutionWebhookTokenHash,
      });

      return BusinessConfigMapper.toDomain(created);
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async findByTenant(): Promise<BusinessConfig | null> {
    const [row] = await this.selectFrom(businessConfigs);
    return row ? BusinessConfigMapper.toDomain(row) : null;
  }

  async findBySlugUnscoped(slug: string): Promise<BusinessConfig | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(businessConfigs)
      .where(eq(businessConfigs.slug, slug))
      .limit(1);

    return row ? BusinessConfigMapper.toDomain(row) : null;
  }

  async findByEvolutionInstanceNameUnscoped(
    instanceName: string,
  ): Promise<BusinessConfig | null> {
    const [row] = await this.drizzle.db
      .select()
      .from(businessConfigs)
      .where(eq(businessConfigs.evolutionInstanceName, instanceName))
      .limit(1);

    return row ? BusinessConfigMapper.toDomain(row) : null;
  }

  async update(data: UpdateBusinessConfigData): Promise<BusinessConfig | null> {
    try {
      const [updated] = await this.updateIn(businessConfigs, data);
      return updated ? BusinessConfigMapper.toDomain(updated) : null;
    } catch (error) {
      throw DatabaseErrorTranslator.toDomain(error);
    }
  }

  async deleteAllUnscoped(): Promise<void> {
    await this.drizzle.db.delete(businessConfigs);
  }
}
