import { ErrorCode, ValidationError } from '@domain/common/exceptions';

export enum PlanCap {
  PROFESSIONALS = 'professionals',
  SERVICES = 'services',
  BRANCHES = 'branches',
  PANEL_USERS = 'panelUsers',
}

export enum PlanFeature {
  MULTI_BRANCH = 'multiBranch',
  WEB_BOOKING_PAGE = 'webBookingPage',
  SESSION_PACKAGES = 'sessionPackages',
  REMINDERS = 'reminders',
  REPORTS = 'reports',
}

export enum PlanQuota {
  AI_REPLIES_PER_PERIOD = 'aiRepliesPerPeriod',
}

export interface PlanQuotas {
  aiRepliesPerPeriod: number | null;
}

export interface PlanCaps {
  professionals: number | null;
  services: number | null;
  branches: number | null;
  panelUsers: number | null;
}

export interface PlanFeatures {
  multiBranch: boolean;
  webBookingPage: boolean;
  sessionPackages: boolean;
  reminders: boolean;
  reports: boolean;
}

export interface PlanConfig {
  quotas: PlanQuotas;
  caps: PlanCaps;
  features: PlanFeatures;
}

export type PartialPlanConfig = {
  quotas?: Partial<PlanQuotas>;
  caps?: Partial<PlanCaps>;
  features?: Partial<PlanFeatures>;
};

// Permissive defaults: adding a key never turns anything off by surprise.
// Restricting is always an explicit decision written on the plan row.
export const DEFAULT_PLAN_CONFIG: PlanConfig = {
  quotas: {
    aiRepliesPerPeriod: null,
  },
  caps: {
    professionals: null,
    services: null,
    branches: null,
    panelUsers: null,
  },
  features: {
    multiBranch: true,
    webBookingPage: true,
    sessionPackages: true,
    reminders: true,
    reports: true,
  },
};

function assertNullableNonNegativeInteger(
  value: unknown,
  path: string,
): number | null {
  if (value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    !Number.isFinite(value)
  ) {
    throw new ValidationError(ErrorCode.PLAN_CONFIG_INVALID, { path });
  }
  return value;
}

function assertBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(ErrorCode.PLAN_CONFIG_INVALID, { path });
  }
  return value;
}

// Accepts a full or partial config from JSON. Unknown keys are ignored so older
// rows keep working when a new key lands in DEFAULT_PLAN_CONFIG.
export function parsePartialPlanConfig(raw: unknown): PartialPlanConfig {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError(ErrorCode.PLAN_CONFIG_INVALID, { path: 'root' });
  }

  const input = raw as Record<string, unknown>;
  const result: PartialPlanConfig = {};

  if (input.quotas !== undefined) {
    if (
      typeof input.quotas !== 'object' ||
      input.quotas === null ||
      Array.isArray(input.quotas)
    ) {
      throw new ValidationError(ErrorCode.PLAN_CONFIG_INVALID, {
        path: 'quotas',
      });
    }
    const quotas = input.quotas as Record<string, unknown>;
    result.quotas = {};
    if (quotas.aiRepliesPerPeriod !== undefined) {
      result.quotas.aiRepliesPerPeriod = assertNullableNonNegativeInteger(
        quotas.aiRepliesPerPeriod,
        'quotas.aiRepliesPerPeriod',
      );
    }
  }

  if (input.caps !== undefined) {
    if (
      typeof input.caps !== 'object' ||
      input.caps === null ||
      Array.isArray(input.caps)
    ) {
      throw new ValidationError(ErrorCode.PLAN_CONFIG_INVALID, {
        path: 'caps',
      });
    }
    const caps = input.caps as Record<string, unknown>;
    result.caps = {};
    for (const key of Object.values(PlanCap)) {
      if (caps[key] !== undefined) {
        result.caps[key] = assertNullableNonNegativeInteger(
          caps[key],
          `caps.${key}`,
        );
      }
    }
  }

  if (input.features !== undefined) {
    if (
      typeof input.features !== 'object' ||
      input.features === null ||
      Array.isArray(input.features)
    ) {
      throw new ValidationError(ErrorCode.PLAN_CONFIG_INVALID, {
        path: 'features',
      });
    }
    const features = input.features as Record<string, unknown>;
    result.features = {};
    for (const key of Object.values(PlanFeature)) {
      if (features[key] !== undefined) {
        result.features[key] = assertBoolean(features[key], `features.${key}`);
      }
    }
  }

  return result;
}

export function resolvePlanConfig(
  planConfig: PartialPlanConfig = {},
  overrides: PartialPlanConfig | null = null,
): PlanConfig {
  const parsedPlan = parsePartialPlanConfig(planConfig);
  const parsedOverrides = parsePartialPlanConfig(overrides);

  return {
    quotas: {
      ...DEFAULT_PLAN_CONFIG.quotas,
      ...parsedPlan.quotas,
      ...parsedOverrides.quotas,
    },
    caps: {
      ...DEFAULT_PLAN_CONFIG.caps,
      ...parsedPlan.caps,
      ...parsedOverrides.caps,
    },
    features: {
      ...DEFAULT_PLAN_CONFIG.features,
      ...parsedPlan.features,
      ...parsedOverrides.features,
    },
  };
}
