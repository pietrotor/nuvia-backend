import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ChangeBusinessCategoryDto } from '@application/business-config/dto/change-business-category.dto';
import { ChangeBusinessCategoryUseCase } from '@application/business-config/use-cases/change-business-category.use-case';
import { CreateTenantDto } from '@application/tenants/dto/create-tenant.dto';
import { UpdateTenantDto } from '@application/tenants/dto/update-tenant.dto';
import { CreateTenantUseCase } from '@application/tenants/use-cases/create-tenant.use-case';
import { ListTenantsUseCase } from '@application/tenants/use-cases/list-tenants.use-case';
import { GetTenantUseCase } from '@application/tenants/use-cases/get-tenant.use-case';
import { UpdateTenantUseCase } from '@application/tenants/use-cases/update-tenant.use-case';
import { Role } from '@domain/users/value-objects/role.vo';
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
  ) {}

  @Get('me')
  @Auth(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Returns the business of the token' })
  async findMine(
    @CurrentTenant() tenantId: string,
  ): Promise<TenantResponseDto> {
    return TenantResponseDto.from(await this.getTenant.execute(tenantId));
  }

  @Patch('me')
  @Auth(Role.OWNER)
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
  @Auth(Role.SUPERADMIN)
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
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Lists all the businesses (support only)' })
  async findAll(): Promise<TenantResponseDto[]> {
    const tenants = await this.listTenants.execute();

    return tenants.map(TenantResponseDto.from);
  }

  @Patch(':tenantId/business-category')
  @Auth(Role.SUPERADMIN)
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
