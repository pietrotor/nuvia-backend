import { Global, Module } from '@nestjs/common';

import { TENANT_REPOSITORY } from '@domain/tenants/repositories/tenant.repository';
import { USER_REPOSITORY } from '@domain/users/repositories/user.repository';
import { AUDIT_LOG_REPOSITORY } from '@domain/audit/repositories/audit-log.repository';
import { DrizzleTenantRepository } from './repositories/tenant.repository.impl';
import { DrizzleUserRepository } from './repositories/user.repository.impl';
import { DrizzleAuditLogRepository } from './repositories/audit-log.repository.impl';

// Every repository token is bound here and nowhere else: binding the same token in
// two modules would give each one a different instance.
@Global()
@Module({
  providers: [
    { provide: TENANT_REPOSITORY, useClass: DrizzleTenantRepository },
    { provide: USER_REPOSITORY, useClass: DrizzleUserRepository },
    { provide: AUDIT_LOG_REPOSITORY, useClass: DrizzleAuditLogRepository },
  ],
  exports: [TENANT_REPOSITORY, USER_REPOSITORY, AUDIT_LOG_REPOSITORY],
})
export class PersistenceModule {}
