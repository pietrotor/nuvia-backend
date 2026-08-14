import { Module } from '@nestjs/common';

import { CreateServiceUseCase } from '@application/services/use-cases/create-service.use-case';
import { ListServicesUseCase } from '@application/services/use-cases/list-services.use-case';
import { UpdateServiceUseCase } from '@application/services/use-cases/update-service.use-case';
import { DepositQrAssignmentValidator } from '@application/services/services/deposit-qr-assignment-validator.service';
import { ServicesController } from './services.controller';

@Module({
  controllers: [ServicesController],
  providers: [
    CreateServiceUseCase,
    ListServicesUseCase,
    UpdateServiceUseCase,
    DepositQrAssignmentValidator,
  ],
  exports: [ListServicesUseCase],
})
export class ServicesModule {}
