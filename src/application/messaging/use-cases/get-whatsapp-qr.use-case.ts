import { Inject, Injectable } from '@nestjs/common';

import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { ErrorCode, ValidationError } from '@domain/common/exceptions';
import {
  WHATSAPP_SESSION_PORT,
  WhatsAppSessionPort,
  WhatsAppSessionQr,
} from '@domain/messaging/ports/whatsapp-session.port';

@Injectable()
export class GetWhatsAppQrUseCase {
  constructor(
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(WHATSAPP_SESSION_PORT)
    private readonly whatsappSession: WhatsAppSessionPort,
  ) {}

  async execute(): Promise<WhatsAppSessionQr> {
    const config = await this.businessConfigRepository.findByTenant();
    if (!config) throw new BusinessConfigNotFoundError();
    if (!config.evolutionInstanceName) {
      throw new ValidationError(ErrorCode.WHATSAPP_SESSION_NOT_CONNECTED);
    }
    // Asking the provider for a QR restarts the underlying socket, which would
    // drop a session that is already linked.
    const status = await this.whatsappSession.getStatus(
      config.evolutionInstanceName,
    );
    if (status.connected) {
      throw new ValidationError(ErrorCode.WHATSAPP_SESSION_ALREADY_CONNECTED);
    }

    return this.whatsappSession.getQr(config.evolutionInstanceName);
  }
}
