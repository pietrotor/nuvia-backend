import { Module } from '@nestjs/common';

import { DepositsApplicationModule } from '@application/deposits/deposits-application.module';
import { DepositQrsController } from './deposit-qrs.controller';

@Module({
  imports: [DepositsApplicationModule],
  controllers: [DepositQrsController],
  exports: [DepositsApplicationModule],
})
export class DepositsModule {}
