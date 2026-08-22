import { Module } from '@nestjs/common';

import { RemindersModule } from '@application/reminders/reminders.module';
import { AttachDepositReceiptUseCase } from './use-cases/attach-deposit-receipt.use-case';
import { CaptureInboundDepositReceiptUseCase } from './use-cases/capture-inbound-deposit-receipt.use-case';
import { GetDepositQrImageUseCase } from './use-cases/get-deposit-qr-image.use-case';
import { GetDepositReceiptImageUseCase } from './use-cases/get-deposit-receipt-image.use-case';
import { ListDepositQrsUseCase } from './use-cases/list-deposit-qrs.use-case';
import { SendDepositQrUseCase } from './use-cases/send-deposit-qr.use-case';
import { UpdateDepositQrUseCase } from './use-cases/update-deposit-qr.use-case';
import { UploadDepositQrUseCase } from './use-cases/upload-deposit-qr.use-case';
import { UploadDepositReceiptUseCase } from './use-cases/upload-deposit-receipt.use-case';
import { VerifyDepositUseCase } from './use-cases/verify-deposit.use-case';
import { ReceiveDepositReceiptUseCase } from './use-cases/receive-deposit-receipt.use-case';
import { AssignDepositReceiptUseCase } from './use-cases/assign-deposit-receipt.use-case';
import { ExpectDepositReceiptUseCase } from './use-cases/expect-deposit-receipt.use-case';

const providers = [
  UploadDepositQrUseCase,
  ListDepositQrsUseCase,
  UpdateDepositQrUseCase,
  GetDepositQrImageUseCase,
  SendDepositQrUseCase,
  ReceiveDepositReceiptUseCase,
  AssignDepositReceiptUseCase,
  ExpectDepositReceiptUseCase,
  AttachDepositReceiptUseCase,
  CaptureInboundDepositReceiptUseCase,
  GetDepositReceiptImageUseCase,
  UploadDepositReceiptUseCase,
  VerifyDepositUseCase,
];

@Module({
  imports: [RemindersModule],
  providers,
  exports: providers,
})
export class DepositsApplicationModule {}
