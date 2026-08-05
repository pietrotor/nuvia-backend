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

@Injectable()
export class DisconnectWhatsAppSessionUseCase {
  constructor(
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(WHATSAPP_SESSION_PORT)
    private readonly whatsappSession: WhatsAppSessionPort,
  ) {}

  async execute(): Promise<void> {
    const config = await this.businessConfigRepository.findByTenant();
    if (!config) throw new BusinessConfigNotFoundError();

    if (config.evolutionInstanceName) {
      await this.whatsappSession.disconnect(config.evolutionInstanceName);
    }
    await this.businessConfigRepository.update({
      evolutionInstanceId: null,
      evolutionInstanceName: null,
      evolutionWebhookTokenHash: null,
      whatsappPhone: null,
    });
  }
}
