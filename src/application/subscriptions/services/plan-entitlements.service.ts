import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  AGENT_USAGE_VIEW_REPOSITORY,
  AgentUsageViewRepository,
} from '@domain/subscriptions/repositories/agent-usage.view-repository';
import {
  PLAN_USAGE_VIEW_REPOSITORY,
  PlanUsageViewRepository,
} from '@domain/subscriptions/repositories/plan-usage.view-repository';
import {
  SUBSCRIPTION_REPOSITORY,
  SubscriptionRepository,
} from '@domain/subscriptions/repositories/subscription.repository';
import {
  PlanCap,
  PlanConfig,
  PlanFeature,
} from '@domain/subscriptions/value-objects/plan-config.vo';
import {
  AgentAccessDecision,
  evaluateAgentAccess,
} from '@domain/subscriptions/services/subscription-access';
import {
  PlanFeatureNotAvailableError,
  PlanLimitReachedError,
} from '@domain/subscriptions/exceptions/subscription.exceptions';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

const CAP_LABELS: Record<PlanCap, string> = {
  [PlanCap.PROFESSIONALS]: 'profesionales',
  [PlanCap.SERVICES]: 'servicios',
  [PlanCap.BRANCHES]: 'sucursales',
  [PlanCap.PANEL_USERS]: 'usuarios del panel',
};

const FEATURE_LABELS: Record<PlanFeature, string> = {
  [PlanFeature.MULTI_BRANCH]: 'múltiples sucursales',
  [PlanFeature.WEB_BOOKING_PAGE]: 'página de reservas',
  [PlanFeature.SESSION_PACKAGES]: 'paquetes de sesiones',
  [PlanFeature.REMINDERS]: 'recordatorios',
  [PlanFeature.REPORTS]: 'reportes',
};

// Without a subscription nothing is granted: zero caps, every feature off, and
// an empty AI quota. Fail-closed so a missing row cannot silently open the door.
const LOCKED_PLAN_CONFIG: PlanConfig = {
  quotas: { aiRepliesPerPeriod: 0 },
  caps: {
    professionals: 0,
    services: 0,
    branches: 0,
    panelUsers: 0,
  },
  features: {
    multiBranch: false,
    webBookingPage: false,
    sessionPackages: false,
    reminders: false,
    reports: false,
  },
};

@Injectable()
export class PlanEntitlements {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepository,
    @Inject(AGENT_USAGE_VIEW_REPOSITORY)
    private readonly agentUsage: AgentUsageViewRepository,
    @Inject(PLAN_USAGE_VIEW_REPOSITORY)
    private readonly planUsage: PlanUsageViewRepository,
    @Inject(TENANT_REPOSITORY)
    private readonly tenants: TenantRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
  ) {}

  async effectiveConfig(): Promise<PlanConfig> {
    const subscription = await this.subscriptions.findCurrentWithPlan();
    return subscription?.effectiveConfig() ?? LOCKED_PLAN_CONFIG;
  }

  async agentAccess(): Promise<AgentAccessDecision> {
    const subscription = await this.subscriptions.findCurrentWithPlan();
    const tenantId =
      subscription?.tenantId ?? this.tenantContext.tenantId ?? null;
    const tenant = tenantId ? await this.tenants.findById(tenantId) : null;
    const used = subscription
      ? await this.agentUsage.countAgentRepliesBetween({
          from: subscription.currentPeriodStart,
          to: subscription.currentPeriodEnd,
        })
      : 0;

    return evaluateAgentAccess({
      tenantStatus: tenant?.status ?? TenantStatus.SUSPENDED,
      subscription,
      aiRepliesUsed: used,
      now: this.clock.now(),
    });
  }

  async assertWithinCap(cap: PlanCap): Promise<void> {
    const config = await this.effectiveConfig();
    const limit = config.caps[cap];
    if (limit === null) return;

    const counts = await this.planUsage.currentCounts();
    if (counts[cap] >= limit) {
      throw new PlanLimitReachedError(CAP_LABELS[cap], limit);
    }
  }

  async assertFeatureEnabled(feature: PlanFeature): Promise<void> {
    const config = await this.effectiveConfig();
    if (!config.features[feature]) {
      throw new PlanFeatureNotAvailableError(FEATURE_LABELS[feature]);
    }
  }
}
