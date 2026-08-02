import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateTenantDto } from '@application/tenants/dto/create-tenant.dto';
import { UpdateTenantDto } from '@application/tenants/dto/update-tenant.dto';
import { CreateTenantUseCase } from '@application/tenants/use-cases/create-tenant.use-case';
import { ListTenantsUseCase } from '@application/tenants/use-cases/list-tenants.use-case';
import { GetTenantUseCase } from '@application/tenants/use-cases/get-tenant.use-case';
import { UpdateTenantUseCase } from '@application/tenants/use-cases/update-tenant.use-case';
import { Role } from '@domain/users/value-objects/role.vo';
import { Auth, CurrentTenant } from '../common/decorators';
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
  ) {}

  @Get('me')
  @Auth(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Devuelve el negocio del token' })
  async findMine(
    @CurrentTenant() tenantId: string,
  ): Promise<TenantResponseDto> {
    return TenantResponseDto.from(await this.getTenant.execute(tenantId));
  }

  @Patch('me')
  @Auth(Role.OWNER)
  @ApiOperation({ summary: 'Actualiza la configuración del negocio del token' })
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
  @ApiOperation({ summary: 'Crea un negocio y su propietario (solo soporte)' })
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
  @ApiOperation({ summary: 'Lista todos los negocios (solo soporte)' })
  async findAll(): Promise<TenantResponseDto[]> {
    const tenants = await this.listTenants.execute();

    return tenants.map(TenantResponseDto.from);
  }
}
