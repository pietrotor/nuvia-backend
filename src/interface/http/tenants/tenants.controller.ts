import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ChangeBusinessCategoryDto } from '@application/business-config/dto/change-business-category.dto';
import { ChangeBusinessCategoryUseCase } from '@application/business-config/use-cases/change-business-category.use-case';
import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { DEFAULT_COUNTRY_CODE } from '@domain/common/value-objects/country-code.vo';
import { CreateTenantDto } from '@application/tenants/dto/create-tenant.dto';
import { UpdateTenantDto } from '@application/tenants/dto/update-tenant.dto';
import { CreateTenantUseCase } from '@application/tenants/use-cases/create-tenant.use-case';
import { ListTenantsUseCase } from '@application/tenants/use-cases/list-tenants.use-case';
import { GetTenantUseCase } from '@application/tenants/use-cases/get-tenant.use-case';
import { UpdateTenantUseCase } from '@application/tenants/use-cases/update-tenant.use-case';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth, CurrentTenant } from '../common/decorators';
import { BusinessConfigResponseDto } from '../business-config/dto/business-config-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly createTenant: CreateTenantUseCase,
    private readonly listTenants: ListTenantsUseCase,
    private readonly getTenant: GetTenantUseCase,
    private readonly updateTenant: UpdateTenantUseCase,
    private readonly changeBusinessCategory: ChangeBusinessCategoryUseCase,
    private readonly getBusinessConfig: GetBusinessConfigUseCase,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
  ) {}

  @Get('me')
  @Auth(Permission.TENANT_READ)
  @ApiOperation({ summary: 'Returns the business of the token' })
  async findMine(
    @CurrentTenant() tenantId: string,
  ): Promise<TenantResponseDto> {
    const [tenant, config] = await Promise.all([
      this.getTenant.execute(tenantId),
      this.getBusinessConfig.execute().catch(() => null),
    ]);

    return TenantResponseDto.from(
      tenant,
      config?.countryCode ?? DEFAULT_COUNTRY_CODE,
      config?.businessCategory,
    );
  }

  @Patch('me')
  @Auth(Permission.TENANT_WRITE)
  @ApiOperation({
    summary: 'Updates the configuration of the business of the token',
  })
  async updateMine(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    return TenantResponseDto.from(
      await this.updateTenant.execute(tenantId, dto),
    );
  }

  @Post()
  @Auth(Permission.TENANTS_ADMIN)
  @ApiOperation({ summary: 'Creates a business and its owner (support only)' })
  async create(
    @Body() dto: CreateTenantDto,
  ): Promise<{ tenant: TenantResponseDto; owner: UserResponseDto }> {
    const { tenant, owner } = await this.createTenant.execute(dto);

    return {
      tenant: TenantResponseDto.from(tenant),
      owner: UserResponseDto.from(owner),
    };
  }

  @Get()
  @Auth(Permission.TENANTS_ADMIN)
  @ApiOperation({ summary: 'Lists all the businesses (support only)' })
  async findAll(): Promise<TenantResponseDto[]> {
    const tenants = await this.listTenants.execute();
    const countryCodes =
      await this.businessConfigRepository.findCountryCodesByTenantIdsUnscoped(
        tenants.map((tenant) => tenant.id),
      );

    return tenants.map((tenant) =>
      TenantResponseDto.from(
        tenant,
        countryCodes.get(tenant.id) ?? DEFAULT_COUNTRY_CODE,
      ),
    );
  }

  @Patch(':tenantId/business-category')
  @Auth(Permission.TENANTS_ADMIN)
  @ApiOperation({
    summary: 'Changes the trade the agent of a business is set up for',
  })
  async changeCategory(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: ChangeBusinessCategoryDto,
  ): Promise<BusinessConfigResponseDto> {
    return BusinessConfigResponseDto.from(
      await this.changeBusinessCategory.execute(tenantId, dto),
    );
  }
}
