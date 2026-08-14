import { Money } from '@domain/common/value-objects/money.vo';

import { Plan } from '../entities/plan.entity';
import { PartialPlanConfig } from '../value-objects/plan-config.vo';

export interface CreatePlanData {
  code: string;
  name: string;
  isActive?: boolean;
  price: Money;
  billingPeriodMonths?: number;
  config?: PartialPlanConfig;
}

export interface UpdatePlanData {
  name?: string;
  isActive?: boolean;
  price?: Money;
  billingPeriodMonths?: number;
  config?: PartialPlanConfig;
}

export interface PlanRepository {
  create(data: CreatePlanData): Promise<Plan>;
  findById(id: string): Promise<Plan | null>;
  findByCode(code: string): Promise<Plan | null>;
  findAll(options?: { activeOnly?: boolean }): Promise<Plan[]>;
  update(id: string, data: UpdatePlanData): Promise<Plan | null>;
  deleteAll(): Promise<void>;
}

export const PLAN_REPOSITORY = 'PlanRepository';

export const TRIAL_PLAN_CODE = 'trial';
