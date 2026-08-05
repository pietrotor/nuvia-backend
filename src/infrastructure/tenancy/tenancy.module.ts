import { Global, Module } from '@nestjs/common';

import { TENANT_CONTEXT_PORT } from '@domain/tenants/ports/tenant-context.port';

import { TenantContextService } from './tenant-context.service';
import { TenantContextMiddleware } from './tenant-context.middleware';

@Global()
@Module({
  providers: [
    TenantContextService,
    { provide: TENANT_CONTEXT_PORT, useExisting: TenantContextService },
    TenantContextMiddleware,
  ],
  exports: [TenantContextService, TENANT_CONTEXT_PORT, TenantContextMiddleware],
})
export class TenancyModule {}
