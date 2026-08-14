import { Currency } from '@domain/common/value-objects/currency.vo';

import {
  BusinessConfig,
  AgentTone,
  AgentPolicy,
  BookingPolicy,
} from '../entities/business-config.entity';
import { BusinessCategory } from '../value-objects/business-category.vo';

export interface CreateBusinessConfigData {
  slug: string;
  agentName?: string;
  tone?: AgentTone;
  businessCategory?: BusinessCategory;
  currency?: Currency;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  bookingPolicy: BookingPolicy;
  agentPolicy?: AgentPolicy;
  faq?: Record<string, string>;
  evolutionInstanceId?: string | null;
  evolutionInstanceName?: string | null;
  evolutionWebhookTokenHash?: string | null;
}

export interface UpdateBusinessConfigData {
  slug?: string;
  agentName?: string;
  tone?: AgentTone;
  // Support only: the owner cannot change the trade its agent was set up for.
  businessCategory?: BusinessCategory;
  currency?: Currency;
  logoUrl?: string | null;
  whatsappPhone?: string | null;
  bookingPolicy?: BookingPolicy;
  agentPolicy?: AgentPolicy;
  faq?: Record<string, string>;
  evolutionInstanceId?: string | null;
  evolutionInstanceName?: string | null;
  evolutionWebhookTokenHash?: string | null;
}

export interface BusinessConfigRepository {
  create(data: CreateBusinessConfigData): Promise<BusinessConfig>;
  findByTenant(): Promise<BusinessConfig | null>;
  findBySlugUnscoped(slug: string): Promise<BusinessConfig | null>;
  findByEvolutionInstanceNameUnscoped(
    instanceName: string,
  ): Promise<BusinessConfig | null>;
  update(data: UpdateBusinessConfigData): Promise<BusinessConfig | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const BUSINESS_CONFIG_REPOSITORY = 'BusinessConfigRepository';
