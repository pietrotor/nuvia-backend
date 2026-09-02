import { ApiProperty } from '@nestjs/swagger';

import { Tenant } from '@domain/tenants/entities/tenant.entity';
import { TenantStatus } from '@domain/tenants/value-objects/tenant-status.vo';
import { DEFAULT_COUNTRY_CODE } from '@domain/common/value-objects/country-code.vo';
import {
  BusinessCategory,
  DEFAULT_BUSINESS_CATEGORY,
} from '@domain/business-config/value-objects/business-category.vo';
import { CategoryLexiconResponseDto } from '@interface/http/business-config/dto/category-lexicon-response.dto';

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

  @ApiProperty({ enum: BusinessCategory })
  businessCategory: BusinessCategory;

  @ApiProperty({ type: CategoryLexiconResponseDto })
  lexicon: CategoryLexiconResponseDto;

  static from(
    tenant: Tenant,
    countryCode = DEFAULT_COUNTRY_CODE,
    businessCategory = DEFAULT_BUSINESS_CATEGORY,
  ): TenantResponseDto {
    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      timezone: tenant.timezone,
      countryCode,
      businessCategory,
      lexicon: CategoryLexiconResponseDto.from(businessCategory),
    };
  }
}
