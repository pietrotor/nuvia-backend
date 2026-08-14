import { Money } from '@domain/common/value-objects/money.vo';
import { Currency } from '@domain/common/value-objects/currency.vo';

import {
  PartialPlanConfig,
  parsePartialPlanConfig,
} from '../value-objects/plan-config.vo';

export interface PlanProps {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  price: Money;
  billingPeriodMonths: number;
  config: PartialPlanConfig;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Plan {
  public readonly id: string;
  public readonly code: string;
  public readonly name: string;
  public readonly isActive: boolean;
  public readonly price: Money;
  public readonly billingPeriodMonths: number;
  public readonly config: PartialPlanConfig;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  constructor(props: PlanProps) {
    this.id = props.id;
    this.code = props.code;
    this.name = props.name;
    this.isActive = props.isActive;
    this.price = props.price;
    this.billingPeriodMonths = props.billingPeriodMonths;
    this.config = parsePartialPlanConfig(props.config);
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static priceFrom(amount: string, currency: string): Money {
    return Money.of(amount, currency as Currency);
  }
}
