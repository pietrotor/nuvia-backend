import { Module } from '@nestjs/common';

import { ChangeBusinessCategoryUseCase } from '@application/business-config/use-cases/change-business-category.use-case';
import { CreateTenantUseCase } from '@application/tenants/use-cases/create-tenant.use-case';
import { ListTenantsUseCase } from '@application/tenants/use-cases/list-tenants.use-case';
import { GetTenantUseCase } from '@application/tenants/use-cases/get-tenant.use-case';
import { UpdateTenantUseCase } from '@application/tenants/use-cases/update-tenant.use-case';
import { TenantsController } from './tenants.controller';

@Module({
  controllers: [TenantsController],
  providers: [
    CreateTenantUseCase,
    ListTenantsUseCase,
    GetTenantUseCase,
    UpdateTenantUseCase,
    ChangeBusinessCategoryUseCase,
  ],
})
export class TenantsModule {}
