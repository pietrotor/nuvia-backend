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
  WhatsAppSessionStatus,
} from '@domain/messaging/ports/whatsapp-session.port';

@Injectable()
export class GetWhatsAppStatusUseCase {
  constructor(
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(WHATSAPP_SESSION_PORT)
    private readonly whatsappSession: WhatsAppSessionPort,
  ) {}

  async execute(): Promise<WhatsAppSessionStatus> {
    const config = await this.businessConfigRepository.findByTenant();
    if (!config) throw new BusinessConfigNotFoundError();
    if (!config.evolutionInstanceName) {
      throw new ValidationError(ErrorCode.WHATSAPP_SESSION_NOT_CONNECTED);
    }

    const status = await this.whatsappSession.getStatus(
      config.evolutionInstanceName,
    );
    if (status.phoneNumber && status.phoneNumber !== config.whatsappPhone) {
      await this.businessConfigRepository.update({
        whatsappPhone: status.phoneNumber,
      });
    }
    return status;
  }
}
