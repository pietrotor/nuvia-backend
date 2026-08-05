import { Inject, Injectable } from '@nestjs/common';

import { ErrorCode, InternalError } from '@domain/common/exceptions';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import {
  MessagingPort,
  SendMediaMessageInput,
  SentMessage,
  SendTextMessageInput,
} from '@domain/messaging/ports/messaging.port';
import { EvolutionApiClient } from './evolution-api.client';

@Injectable()
export class EvolutionMessagingAdapter implements MessagingPort {
  constructor(
    private readonly client: EvolutionApiClient,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
  ) {}

  async sendText(input: SendTextMessageInput): Promise<SentMessage> {
    const instanceName = await this.resolveInstanceName(input.tenantId);
    const response = await this.client.post<{ key: { id: string } }>(
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        number: this.toEvolutionNumber(input.toE164),
        text: input.text,
      },
    );
    return { providerMessageId: response.key.id };
  }

  async sendMedia(input: SendMediaMessageInput): Promise<SentMessage> {
    const instanceName = await this.resolveInstanceName(input.tenantId);
    const mimeType = input.mimeType ?? 'image/png';
    const response = await this.client.post<{ key: { id: string } }>(
      `/message/sendMedia/${encodeURIComponent(instanceName)}`,
      {
        number: this.toEvolutionNumber(input.toE164),
        mediatype: mimeType.startsWith('image/') ? 'image' : 'document',
        mimetype: mimeType,
        caption: input.caption ?? '',
        media: input.mediaUrl,
        fileName: `media.${mimeType.split('/')[1] ?? 'bin'}`,
      },
    );
    return { providerMessageId: response.key.id };
  }

  private async resolveInstanceName(tenantId: string): Promise<string> {
    const config = await this.businessConfigRepository.findByTenant();
    if (
      !config ||
      config.tenantId !== tenantId ||
      !config.evolutionInstanceName
    ) {
      throw new InternalError(ErrorCode.WHATSAPP_SESSION_NOT_CONNECTED);
    }
    return config.evolutionInstanceName;
  }

  private toEvolutionNumber(e164: string): string {
    return e164.replace(/\D/g, '');
  }
}
