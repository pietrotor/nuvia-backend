import { Money } from '@domain/common/value-objects/money.vo';

import { Subscription } from '../entities/subscription.entity';
import { PartialPlanConfig } from '../value-objects/plan-config.vo';
import { SubscriptionStatus } from '../value-objects/subscription-status.vo';

export interface CreateSubscriptionData {
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  configOverrides?: PartialPlanConfig | null;
  price: Money;
  notes?: string | null;
}

export interface UpdateSubscriptionData {
  planId?: string;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  configOverrides?: PartialPlanConfig | null;
  price?: Money;
  notes?: string | null;
  cancelledAt?: Date | null;
}

export interface SubscriptionRepository {
  create(data: CreateSubscriptionData): Promise<Subscription>;
  findCurrent(): Promise<Subscription | null>;
  findCurrentByTenantIdUnscoped(tenantId: string): Promise<Subscription | null>;
  findCurrentWithPlan(): Promise<Subscription | null>;
  findCurrentWithPlanByTenantIdUnscoped(
    tenantId: string,
  ): Promise<Subscription | null>;
  update(
    id: string,
    data: UpdateSubscriptionData,
  ): Promise<Subscription | null>;
  deleteAllUnscoped(): Promise<void>;
}

export const SUBSCRIPTION_REPOSITORY = 'SubscriptionRepository';
