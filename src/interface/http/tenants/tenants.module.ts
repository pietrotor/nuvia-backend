import { Module } from '@nestjs/common';

import { ChangeBusinessCategoryUseCase } from '@application/business-config/use-cases/change-business-category.use-case';
import { BusinessConfigModule } from '@interface/http/business-config/business-config.module';
import { CreateTenantUseCase } from '@application/tenants/use-cases/create-tenant.use-case';
import { ListTenantsUseCase } from '@application/tenants/use-cases/list-tenants.use-case';
import { GetTenantUseCase } from '@application/tenants/use-cases/get-tenant.use-case';
import { UpdateTenantUseCase } from '@application/tenants/use-cases/update-tenant.use-case';
import { TenantsController } from './tenants.controller';

@Module({
  imports: [BusinessConfigModule],
  controllers: [TenantsController],
  providers: [
    CreateTenantUseCase,
    ListTenantsUseCase,
    GetTenantUseCase,
    UpdateTenantUseCase,
    ChangeBusinessCategoryUseCase,
  ],
  exports: [CreateTenantUseCase, ListTenantsUseCase],
})
export class TenantsModule {}
