import { Module } from '@nestjs/common';

import { CreateServiceUseCase } from '@application/services/use-cases/create-service.use-case';
import { ListServicesUseCase } from '@application/services/use-cases/list-services.use-case';
import { UpdateServiceUseCase } from '@application/services/use-cases/update-service.use-case';
import { ServicesController } from './services.controller';

@Module({
  controllers: [ServicesController],
  providers: [CreateServiceUseCase, ListServicesUseCase, UpdateServiceUseCase],
  exports: [ListServicesUseCase],
})
export class ServicesModule {}
