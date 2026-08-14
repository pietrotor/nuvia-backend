import { Money } from '@domain/common/value-objects/money.vo';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { Plan } from '../entities/plan.entity';
import { Subscription } from '../entities/subscription.entity';
import { SubscriptionStatus } from '../value-objects/subscription-status.vo';
import {
  DEFAULT_PLAN_CONFIG,
  parsePartialPlanConfig,
  resolvePlanConfig,
} from '../value-objects/plan-config.vo';
import { evaluateAgentAccess } from './subscription-access';

function buildPlan(
  config: ConstructorParameters<typeof Plan>[0]['config'] = {},
): Plan {
  return new Plan({
    id: 'plan1',
    code: 'starter',
    name: 'Starter',
    isActive: true,
    price: Money.of('350.00', Currency.BOB),
    billingPeriodMonths: 1,
    config,
  });
}

function buildSubscription(
  overrides: Partial<ConstructorParameters<typeof Subscription>[0]> = {},
): Subscription {
  const plan =
    overrides.plan ?? buildPlan({ quotas: { aiRepliesPerPeriod: 100 } });
  return new Subscription({
    id: 'sub1',
    tenantId: 't1',
    planId: plan.id,
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
    configOverrides: null,
    price: Money.of('350.00', Currency.BOB),
    notes: null,
    cancelledAt: null,
    plan,
    ...overrides,
  });
}

describe('resolvePlanConfig', () => {
  it('starts from permissive defaults', () => {
    expect(resolvePlanConfig()).toEqual(DEFAULT_PLAN_CONFIG);
  });

  it('lets tenant overrides win over the plan for a single key', () => {
    const resolved = resolvePlanConfig(
      { quotas: { aiRepliesPerPeriod: 500 }, caps: { professionals: 5 } },
      { caps: { professionals: 8 } },
    );

    expect(resolved.quotas.aiRepliesPerPeriod).toBe(500);
    expect(resolved.caps.professionals).toBe(8);
    expect(resolved.features.reports).toBe(true);
  });

  it('rejects invalid config shapes', () => {
    expect(() =>
      parsePartialPlanConfig({ quotas: { aiRepliesPerPeriod: 'many' } }),
    ).toThrow();
  });
});

describe('evaluateAgentAccess', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');

  it('blocks a suspended tenant even with a healthy subscription', () => {
    const decision = evaluateAgentAccess({
      tenantStatus: TenantStatus.SUSPENDED,
      subscription: buildSubscription(),
      aiRepliesUsed: 0,
      now,
    });

    expect(decision).toEqual({
      allowed: false,
      reason: 'suspended',
      limit: null,
      used: 0,
    });
  });

  it('blocks when there is no subscription', () => {
    expect(
      evaluateAgentAccess({
        tenantStatus: TenantStatus.ACTIVE,
        subscription: null,
        aiRepliesUsed: 0,
        now,
      }).reason,
    ).toBe('no_subscription');
  });

  it('blocks when the period has expired', () => {
    expect(
      evaluateAgentAccess({
        tenantStatus: TenantStatus.ACTIVE,
        subscription: buildSubscription({
          currentPeriodEnd: new Date('2026-08-10T00:00:00.000Z'),
        }),
        aiRepliesUsed: 0,
        now,
      }).reason,
    ).toBe('expired');
  });

  it('blocks when the AI quota is exhausted', () => {
    const decision = evaluateAgentAccess({
      tenantStatus: TenantStatus.ACTIVE,
      subscription: buildSubscription(),
      aiRepliesUsed: 100,
      now,
    });

    expect(decision).toEqual({
      allowed: false,
      reason: 'quota_exhausted',
      limit: 100,
      used: 100,
    });
  });

  it('allows unlimited quotas', () => {
    const decision = evaluateAgentAccess({
      tenantStatus: TenantStatus.ACTIVE,
      subscription: buildSubscription({
        plan: buildPlan({ quotas: { aiRepliesPerPeriod: null } }),
      }),
      aiRepliesUsed: 10_000,
      now,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.limit).toBeNull();
  });

  it('applies negotiated overrides to the quota', () => {
    const decision = evaluateAgentAccess({
      tenantStatus: TenantStatus.ACTIVE,
      subscription: buildSubscription({
        configOverrides: { quotas: { aiRepliesPerPeriod: 150 } },
      }),
      aiRepliesUsed: 120,
      now,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.limit).toBe(150);
  });
});
