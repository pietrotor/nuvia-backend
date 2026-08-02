import { Inject, Injectable } from '@nestjs/common';

import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { Tenant } from '@domain/tenants/entities/tenant.entity';

@Injectable()
export class ListTenantsUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY)
    private readonly tenantRepository: TenantRepository,
  ) {}

  execute(): Promise<Tenant[]> {
    return this.tenantRepository.findAll();
  }
}
