import { Module } from '@nestjs/common';

import { CreateWhatsAppSessionUseCase } from '@application/messaging/use-cases/create-whatsapp-session.use-case';
import { DisconnectWhatsAppSessionUseCase } from '@application/messaging/use-cases/disconnect-whatsapp-session.use-case';
import { GetWhatsAppQrUseCase } from '@application/messaging/use-cases/get-whatsapp-qr.use-case';
import { GetWhatsAppStatusUseCase } from '@application/messaging/use-cases/get-whatsapp-status.use-case';
import { WhatsAppSessionController } from './whatsapp-session.controller';

@Module({
  controllers: [WhatsAppSessionController],
  providers: [
    CreateWhatsAppSessionUseCase,
    DisconnectWhatsAppSessionUseCase,
    GetWhatsAppQrUseCase,
    GetWhatsAppStatusUseCase,
  ],
})
export class MessagingModule {}
