import { Module } from '@nestjs/common';

import { GetDepositQrImageUseCase } from '@application/deposits/use-cases/get-deposit-qr-image.use-case';
import { ListDepositQrsUseCase } from '@application/deposits/use-cases/list-deposit-qrs.use-case';
import { SendDepositQrUseCase } from '@application/deposits/use-cases/send-deposit-qr.use-case';
import { UpdateDepositQrUseCase } from '@application/deposits/use-cases/update-deposit-qr.use-case';
import { UploadDepositQrUseCase } from '@application/deposits/use-cases/upload-deposit-qr.use-case';
import { DepositQrsController } from './deposit-qrs.controller';

@Module({
  controllers: [DepositQrsController],
  providers: [
    UploadDepositQrUseCase,
    ListDepositQrsUseCase,
    UpdateDepositQrUseCase,
    GetDepositQrImageUseCase,
    SendDepositQrUseCase,
  ],
  exports: [ListDepositQrsUseCase, SendDepositQrUseCase],
})
export class DepositsModule {}
