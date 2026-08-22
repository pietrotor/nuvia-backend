import {
  AgentTone,
  BusinessConfig,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessCategory } from '@domain/business-config/value-objects/business-category.vo';
import { Currency } from '@domain/common/value-objects/currency.vo';

import { BusinessConfigSchema } from '../schema/business-config.schema';

export class BusinessConfigMapper {
  static toDomain(row: BusinessConfigSchema): BusinessConfig {
    return new BusinessConfig({
      id: row.id,
      tenantId: row.tenantId,
      slug: row.slug,
      agentName: row.agentName,
      tone: row.tone as AgentTone,
      businessCategory: row.businessCategory as BusinessCategory,
      currency: row.currency as Currency,
      countryCode: row.countryCode,
      logoUrl: row.logoUrl,
      whatsappPhone: row.whatsappPhone,
      bookingPolicy: row.bookingPolicy,
      agentPolicy: row.agentPolicy,
      clientReminderPolicy: row.clientReminderPolicy,
      faq: row.faq ?? {},
      evolutionInstanceId: row.evolutionInstanceId,
      evolutionInstanceName: row.evolutionInstanceName,
      evolutionWebhookTokenHash: row.evolutionWebhookTokenHash,
      evolutionHumanLabelId: row.evolutionHumanLabelId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
