import { ApiProperty } from '@nestjs/swagger';

import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { DEFAULT_COUNTRY_CODE } from '@domain/common/value-objects/country-code.vo';

export class TenantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: TenantStatus })
  status: TenantStatus;

  @ApiProperty()
  timezone: string;

  @ApiProperty({
    example: DEFAULT_COUNTRY_CODE,
    description:
      'ISO 3166-1 alpha-2 country for default phone parsing and display',
  })
  countryCode: string;

  static from(
    tenant: Tenant,
    countryCode = DEFAULT_COUNTRY_CODE,
  ): TenantResponseDto {
    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      timezone: tenant.timezone,
      countryCode,
    };
  }
}
