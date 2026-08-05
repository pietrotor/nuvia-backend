import { Inject, Injectable } from '@nestjs/common';

import { Service } from '@domain/services/entities/service.entity';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';

@Injectable()
export class ListServicesUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
  ) {}

  async execute(): Promise<Service[]> {
    return this.serviceRepository.findAll();
  }
}
