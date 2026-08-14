import { Injectable } from '@nestjs/common';
import { and, count, eq, isNotNull, ne } from 'drizzle-orm';

import { PlanCap } from '@domain/subscriptions/value-objects/plan-config.vo';
import {
  PlanCapCounts,
  PlanUsageViewRepository,
} from '@domain/subscriptions/repositories/plan-usage.view-repository';
import { Role } from '@domain/users/value-objects/role.vo';
import { TenantContextService } from '@infrastructure/tenancy/tenant-context.service';

import { DrizzleService } from '../drizzle/drizzle.service';
import { branches, professionals, services, users } from '../drizzle/schema';
import { TenantScopedRepository } from './tenant-scoped.repository';

@Injectable()
export class DrizzlePlanUsageViewRepository
  extends TenantScopedRepository
  implements PlanUsageViewRepository
{
  constructor(drizzle: DrizzleService, tenantContext: TenantContextService) {
    super(drizzle, tenantContext);
  }

  async currentCounts(): Promise<PlanCapCounts> {
    const tenantId = this.tenantId;

    const [professionalsRow] = await this.drizzle.db
      .select({ value: count() })
      .from(professionals)
      .where(
        and(
          eq(professionals.tenantId, tenantId),
          eq(professionals.isActive, true),
        ),
      );

    const [servicesRow] = await this.drizzle.db
      .select({ value: count() })
      .from(services)
      .where(and(eq(services.tenantId, tenantId), eq(services.isActive, true)));

    const [branchesRow] = await this.drizzle.db
      .select({ value: count() })
      .from(branches)
      .where(and(eq(branches.tenantId, tenantId), eq(branches.isActive, true)));

    const [usersRow] = await this.drizzle.db
      .select({ value: count() })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.isActive, true),
          ne(users.role, Role.SUPERADMIN),
          isNotNull(users.tenantId),
        ),
      );

    return {
      [PlanCap.PROFESSIONALS]: Number(professionalsRow?.value ?? 0),
      [PlanCap.SERVICES]: Number(servicesRow?.value ?? 0),
      [PlanCap.BRANCHES]: Number(branchesRow?.value ?? 0),
      [PlanCap.PANEL_USERS]: Number(usersRow?.value ?? 0),
    };
  }
}
