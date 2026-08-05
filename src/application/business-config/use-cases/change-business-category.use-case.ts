import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';
import { ChangeBusinessCategoryDto } from '../dto/change-business-category.dto';

@Injectable()
export class ChangeBusinessCategoryUseCase {
  constructor(
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    private readonly audit: AuditRecorder,
  ) {}

  // Support only: the trade decides what the agent may say, so it is not the owner's to change.
  async execute(
    tenantId: string,
    dto: ChangeBusinessCategoryDto,
  ): Promise<BusinessConfig> {
    return this.tenantContext.runWithTenant(tenantId, async () => {
      const current = await this.businessConfigRepository.findByTenant();
      if (!current) throw new BusinessConfigNotFoundError();
      if (current.businessCategory === dto.businessCategory) return current;

      const updated = await this.businessConfigRepository.update({
        businessCategory: dto.businessCategory,
      });
      if (!updated) throw new BusinessConfigNotFoundError();

      await this.audit.record({
        action: AuditAction.BUSINESS_CATEGORY_CHANGED,
        entity: 'business_config',
        entityId: updated.id,
        tenantId,
        before: { businessCategory: current.businessCategory },
        after: { businessCategory: updated.businessCategory },
      });

      return updated;
    });
  }
}
