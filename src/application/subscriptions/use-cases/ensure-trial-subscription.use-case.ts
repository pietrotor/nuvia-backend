import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { InternalError } from '@domain/common/exceptions';
import { ErrorCode } from '@domain/common/exceptions/error-code';
import { Subscription } from '@domain/subscriptions/entities/subscription.entity';
import {
  PLAN_REPOSITORY,
  PlanRepository,
  TRIAL_PLAN_CODE,
} from '@domain/subscriptions/repositories/plan.repository';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '@domain/subscriptions/repositories/subscription.repository';
import { SubscriptionStatus } from '@domain/subscriptions/value-objects/subscription-status.vo';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

const DEFAULT_TRIAL_DAYS = 14;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Creates the trial plan on first need and attaches a trialing subscription to
// a freshly created tenant. Onboarding is assisted, so every tenant goes through
// CreateTenantUseCase and therefore always leaves with a subscription.
@Injectable()
export class EnsureTrialSubscriptionUseCase {
  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly plans: PlanRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async execute(tenantId: string): Promise<Subscription> {
    const plan =
      (await this.plans.findByCode(TRIAL_PLAN_CODE)) ??
      (await this.plans.create({
        code: TRIAL_PLAN_CODE,
        name: 'Prueba',
        isActive: true,
        price: Money.of('0.00', Currency.BOB),
        billingPeriodMonths: 1,
        config: {
          quotas: { aiRepliesPerPeriod: 200 },
          caps: {
            professionals: 3,
            services: 20,
            branches: 1,
            panelUsers: 3,
          },
          features: {
            multiBranch: false,
            webBookingPage: false,
            sessionPackages: false,
            reminders: false,
            reports: false,
          },
        },
      }));

    return this.tenantContext.runWithTenant(tenantId, async () => {
      const existing = await this.subscriptions.findCurrent();
      if (existing) return existing;

      const now = this.clock.now();
      try {
        return await this.subscriptions.create({
          planId: plan.id,
          status: SubscriptionStatus.TRIALING,
          currentPeriodStart: now,
          currentPeriodEnd: addDays(now, DEFAULT_TRIAL_DAYS),
          price: plan.price,
          notes: 'Trial onboarding',
        });
      } catch (error) {
        throw new InternalError(ErrorCode.INTERNAL_ERROR, {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }
}
