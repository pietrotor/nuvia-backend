import { PlanCap } from '../value-objects/plan-config.vo';

export type PlanCapCounts = Record<PlanCap, number>;

export interface PlanUsageViewRepository {
  currentCounts(): Promise<PlanCapCounts>;
}

export const PLAN_USAGE_VIEW_REPOSITORY = 'PlanUsageViewRepository';
