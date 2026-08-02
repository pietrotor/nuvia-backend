import { ApiProperty } from '@nestjs/swagger';

import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { Vertical } from '@domain/tenants/value-objects/vertical.vo';

export class TenantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: Vertical })
  vertical: Vertical;

  @ApiProperty({ enum: TenantStatus })
  status: TenantStatus;

  @ApiProperty()
  timezone: string;

  @ApiProperty({ nullable: true })
  whatsappPhone: string | null;

  @ApiProperty({ nullable: true })
  staticQrUrl: string | null;

  @ApiProperty({ nullable: true })
  plan: string | null;

  @ApiProperty()
  readyToBill: boolean;

  static from(tenant: Tenant): TenantResponseDto {
    return {
      id: tenant.id,
      name: tenant.name,
      vertical: tenant.vertical,
      status: tenant.status,
      timezone: tenant.timezone,
      whatsappPhone: tenant.whatsappPhone,
      staticQrUrl: tenant.staticQrUrl,
      plan: tenant.plan,
      readyToBill: tenant.isReadyToBill(),
    };
  }
}
