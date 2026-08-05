import { ApiProperty } from '@nestjs/swagger';

import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';

export class TenantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: TenantStatus })
  status: TenantStatus;

  @ApiProperty()
  timezone: string;

  @ApiProperty({ nullable: true })
  plan: string | null;

  static from(tenant: Tenant): TenantResponseDto {
    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      timezone: tenant.timezone,
      plan: tenant.plan,
    };
  }
}
