import { Money } from '@domain/common/value-objects/money.vo';
import { Currency } from '@domain/common/value-objects/currency.vo';

import {
  PartialPlanConfig,
  PlanConfig,
  parsePartialPlanConfig,
  resolvePlanConfig,
} from '../value-objects/plan-config.vo';
import {
  isOperableSubscriptionStatus,
  SubscriptionStatus,
} from '../value-objects/subscription-status.vo';
import { Plan } from './plan.entity';

export interface SubscriptionProps {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  configOverrides: PartialPlanConfig | null;
  price: Money;
  notes: string | null;
  cancelledAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  plan?: Plan | null;
}

export class Subscription {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly planId: string;
  public readonly status: SubscriptionStatus;
  public readonly currentPeriodStart: Date;
  public readonly currentPeriodEnd: Date;
  public readonly configOverrides: PartialPlanConfig | null;
  public readonly price: Money;
  public readonly notes: string | null;
  public readonly cancelledAt: Date | null;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;
  public readonly plan: Plan | null;

  constructor(props: SubscriptionProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.planId = props.planId;
    this.status = props.status;
    this.currentPeriodStart = props.currentPeriodStart;
    this.currentPeriodEnd = props.currentPeriodEnd;
    this.configOverrides =
      props.configOverrides === null
        ? null
        : parsePartialPlanConfig(props.configOverrides);
    this.price = props.price;
    this.notes = props.notes;
    this.cancelledAt = props.cancelledAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.plan = props.plan ?? null;
  }

  isPeriodActive(now: Date): boolean {
    return now >= this.currentPeriodStart && now < this.currentPeriodEnd;
  }

  isOperable(): boolean {
    return isOperableSubscriptionStatus(this.status);
  }

  effectiveConfig(): PlanConfig {
    return resolvePlanConfig(this.plan?.config ?? {}, this.configOverrides);
  }

  static priceFrom(amount: string, currency: string): Money {
    return Money.of(amount, currency as Currency);
  }
}
