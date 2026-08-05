import { Inject, Injectable } from '@nestjs/common';

import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';

@Injectable()
export class GetBusinessConfigUseCase {
  constructor(
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
  ) {}

  async execute(): Promise<BusinessConfig> {
    const config = await this.businessConfigRepository.findByTenant();
    if (!config) throw new BusinessConfigNotFoundError();
    return config;
  }
}
