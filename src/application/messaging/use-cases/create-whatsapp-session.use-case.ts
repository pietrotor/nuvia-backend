import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import {
  WHATSAPP_SESSION_PORT,
  WhatsAppSessionPort,
  WhatsAppSessionQr,
} from '@domain/messaging/ports/whatsapp-session.port';

@Injectable()
export class CreateWhatsAppSessionUseCase {
  constructor(
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(WHATSAPP_SESSION_PORT)
    private readonly whatsappSession: WhatsAppSessionPort,
  ) {}

  async execute(): Promise<WhatsAppSessionQr> {
    const config = await this.businessConfigRepository.findByTenant();
    if (!config) throw new BusinessConfigNotFoundError();

    if (config.evolutionInstanceName) {
      return this.whatsappSession.getQr(config.evolutionInstanceName);
    }

    const instanceName = `nuvi-${config.tenantId}`;
    const session = await this.whatsappSession.createSession({
      tenantId: config.tenantId,
      instanceName,
    });
    if (!session.webhookToken) {
      await this.whatsappSession.disconnect(session.instanceName);
      throw new InternalError(ErrorCode.EVOLUTION_API_ERROR);
    }

    const updated = await this.businessConfigRepository.update({
      evolutionInstanceId: session.instanceId,
      evolutionInstanceName: session.instanceName,
      evolutionWebhookTokenHash: createHash('sha256')
        .update(session.webhookToken)
        .digest('hex'),
    });
    if (!updated) {
      await this.whatsappSession.disconnect(session.instanceName);
      throw new BusinessConfigNotFoundError();
    }

    return { ...session, webhookToken: undefined };
  }
}
