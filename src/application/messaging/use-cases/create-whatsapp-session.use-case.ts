import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import {
  ErrorCode,
  InternalError,
  ValidationError,
} from '@domain/common/exceptions';
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
