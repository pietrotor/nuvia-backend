import { Inject, Injectable } from '@nestjs/common';

import { Plan } from '@domain/subscriptions/entities/plan.entity';
import {
  PLAN_REPOSITORY,
  PlanRepository,
} from '@domain/subscriptions/repositories/plan.repository';

@Injectable()
export class ListPlansUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
  ) {}

  execute(options?: { activeOnly?: boolean }): Promise<Plan[]> {
    return this.plans.findAll(options);
  }
}
