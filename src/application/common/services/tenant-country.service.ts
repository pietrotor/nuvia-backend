import { Inject, Injectable } from '@nestjs/common';

import { DEFAULT_COUNTRY_CODE } from '@domain/common/value-objects/country-code.vo';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';

@Injectable()
export class TenantCountryService {
  constructor(
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
  ) {}

  async getCurrentCountryCode(): Promise<string> {
    const config = await this.businessConfigRepository.findByTenant();
    return config?.countryCode ?? DEFAULT_COUNTRY_CODE;
  }
}
