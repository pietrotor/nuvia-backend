import { Inject, Injectable } from '@nestjs/common';

import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantNotFoundError } from '@domain/tenants/exceptions/tenant.exceptions';

@Injectable()
export class GetTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
  ) {}

  async execute(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(id);

    if (!tenant) {
      throw new TenantNotFoundError(id);
    }

    return tenant;
  }
}
