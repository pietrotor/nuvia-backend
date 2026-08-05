import { Module } from '@nestjs/common';

import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import { UpdateBusinessConfigUseCase } from '@application/business-config/use-cases/update-business-config.use-case';
import { BusinessConfigController } from './business-config.controller';

@Module({
  controllers: [BusinessConfigController],
  providers: [GetBusinessConfigUseCase, UpdateBusinessConfigUseCase],
  exports: [GetBusinessConfigUseCase],
})
export class BusinessConfigModule {}
