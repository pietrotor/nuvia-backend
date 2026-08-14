import { Inject, Injectable } from '@nestjs/common';

import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantNotFoundError } from '@domain/tenants/exceptions/tenant.exceptions';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { UpdateTenantDto } from '../dto/update-tenant.dto';

@Injectable()
export class UpdateTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const current = await this.tenantRepository.findById(id);

    if (!current) {
      throw new TenantNotFoundError(id);
    }

    const updated = await this.tenantRepository.update(id, dto);

    if (!updated) {
      throw new TenantNotFoundError(id);
    }

    await this.audit.record({
      action: AuditAction.TENANT_UPDATED,
      entity: 'tenant',
      entityId: id,
      tenantId: id,
      before: {
        name: current.name,
        timezone: current.timezone,
      },
      after: dto,
    });

    return updated;
  }
}
