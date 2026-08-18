import { Inject, Injectable } from '@nestjs/common';

import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import {
  WHATSAPP_SESSION_PORT,
  WhatsAppSessionPort,
} from '@domain/messaging/ports/whatsapp-session.port';

export interface WhatsAppStatusResult {
  configured: boolean;
  connected: boolean;
  phoneNumber?: string;
}

@Injectable()
export class GetWhatsAppStatusUseCase {
  constructor(
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(WHATSAPP_SESSION_PORT)
    private readonly whatsappSession: WhatsAppSessionPort,
  ) {}

  async execute(): Promise<WhatsAppStatusResult> {
    const config = await this.businessConfigRepository.findByTenant();
    if (!config) throw new BusinessConfigNotFoundError();
    if (!config.evolutionInstanceName) {
      return { configured: false, connected: false };
    }

    const status = await this.whatsappSession.getStatus(
      config.evolutionInstanceName,
    );
    if (status.phoneNumber && status.phoneNumber !== config.whatsappPhone) {
      await this.businessConfigRepository.update({
        whatsappPhone: status.phoneNumber,
      });
    }
    return {
      configured: true,
      connected: status.connected,
      phoneNumber: status.phoneNumber,
    };
  }
}
