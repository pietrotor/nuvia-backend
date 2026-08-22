import { Inject, Injectable } from '@nestjs/common';

import {
  DomainException,
  ErrorCode,
  InternalError,
} from '@domain/common/exceptions';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import { InvalidDepositReceiptFileError } from '@domain/deposits/exceptions/deposit-qr.exceptions';
import {
  DEPOSIT_QR_MAX_SIZE_BYTES,
  DEPOSIT_QR_MAX_SIZE_MB,
} from '@domain/deposits/services/deposit-qr-image-validator';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import {
  MarkAsReadInput,
  MessagingPort,
  DownloadInboundMediaInput,
  InboundMedia,
  SendMediaMessageInput,
  SentMessage,
  SendTextMessageInput,
  ShowTypingInput,
} from '@domain/messaging/ports/messaging.port';
import {
  EVOLUTION_REQUEST_TIMEOUT_MS,
  EvolutionApiClient,
} from './evolution-api.client';

interface EvolutionSendResponse {
  key: { id: string };
}

interface EvolutionMediaResponse {
  mimetype: string;
  base64: string;
}

@Injectable()
export class EvolutionMessagingAdapter implements MessagingPort {
  constructor(
    private readonly client: EvolutionApiClient,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
  ) {}

  async sendText(input: SendTextMessageInput): Promise<SentMessage> {
    const instanceName = await this.resolveInstanceName(input.tenantId);
    const path = `/message/sendText/${encodeURIComponent(instanceName)}`;
    const body = {
      number: this.toEvolutionNumber(input.toE164),
      text: input.text,
    };
    const typingDelayMs = input.typingDelayMs ?? 0;

    if (typingDelayMs > 0) {
      try {
        // Evolution turns `delay` into subscribe → composing → wait → paused
        // before it sends, so the presence itself is not ours to pick.
        const response = await this.client.post<EvolutionSendResponse>(
          path,
          { ...body, delay: typingDelayMs },
          { timeoutMs: EVOLUTION_REQUEST_TIMEOUT_MS + typingDelayMs },
        );
        return { providerMessageId: response.key.id };
      } catch (error) {
        // The typing path is the fragile one (it rejects `@lid` contacts up to
        // 2.4.0-rc1). A silent reply beats no reply, but only one retry: a loop
        // here would burn the number's reach-out budget.
        if (!this.isRejected(error)) throw error;
        this.logger.warn(
          `Evolution rejected the typing indicator, sending without it`,
          EvolutionMessagingAdapter.name,
        );
      }
    }

    const response = await this.client.post<EvolutionSendResponse>(path, body);
    return { providerMessageId: response.key.id };
  }

  async sendMedia(input: SendMediaMessageInput): Promise<SentMessage> {
    const instanceName = await this.resolveInstanceName(input.tenantId);
    const { mimeType } = input;
    const response = await this.client.post<EvolutionSendResponse>(
      `/message/sendMedia/${encodeURIComponent(instanceName)}`,
      {
        number: this.toEvolutionNumber(input.toE164),
        mediatype: mimeType.startsWith('image/') ? 'image' : 'document',
        mimetype: mimeType,
        caption: input.caption ?? '',
        // Evolution reads the same field as a URL or as base64 bytes.
        media:
          input.media.source === 'url'
            ? input.media.url
            : input.media.bytes.toString('base64'),
        fileName: `media.${mimeType.split('/')[1] ?? 'bin'}`,
      },
    );
    return { providerMessageId: response.key.id };
  }

  async markAsRead(input: MarkAsReadInput): Promise<void> {
    const instanceName = await this.resolveInstanceName(input.tenantId);
    await this.client.post(
      `/chat/markMessageAsRead/${encodeURIComponent(instanceName)}`,
      {
        readMessages: [
          {
            remoteJid: this.toRemoteJid(input.toE164),
            fromMe: false,
            id: input.providerMessageId,
          },
        ],
      },
    );
  }

  async showTyping(input: ShowTypingInput): Promise<void> {
    const instanceName = await this.resolveInstanceName(input.tenantId);
    await this.client.post(
      `/chat/sendPresence/${encodeURIComponent(instanceName)}`,
      {
        number: this.toEvolutionNumber(input.toE164),
        presence: 'composing',
        delay: input.durationMs,
      },
      { timeoutMs: EVOLUTION_REQUEST_TIMEOUT_MS + input.durationMs },
    );
  }

  async downloadInboundMedia(
    input: DownloadInboundMediaInput,
  ): Promise<InboundMedia> {
    const instanceName = await this.resolveInstanceName(input.tenantId);
    const response = await this.client.post<EvolutionMediaResponse>(
      `/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`,
      {
        message: { key: { id: input.providerMessageId } },
        convertToMp4: false,
      },
    );
    const mimeType = response.mimetype?.split(';')[0]?.trim().toLowerCase();
    if (!response.base64 || !mimeType) {
      throw new InternalError(ErrorCode.EVOLUTION_API_ERROR, {
        operation: 'download_inbound_media',
        providerMessageId: input.providerMessageId,
      });
    }
    const maximumBase64Length =
      4 * Math.ceil(DEPOSIT_QR_MAX_SIZE_BYTES / 3) + 4;
    if (response.base64.length > maximumBase64Length) {
      throw new InvalidDepositReceiptFileError(DEPOSIT_QR_MAX_SIZE_MB);
    }
    return {
      bytes: Buffer.from(response.base64, 'base64'),
      mimeType,
    };
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

  // Only a rejected presence/LID request is safe to repeat: a timeout may still
  // have been delivered, and retrying that would send the message twice.
  private isRejected(error: unknown): boolean {
    if (
      !(error instanceof DomainException) ||
      error.code !== ErrorCode.EVOLUTION_API_ERROR ||
      error.params.status !== 400
    ) {
      return false;
    }
    const body = String(error.params.body ?? '').toLowerCase();
    // "invalid" contains the letters "lid"; match a LID token, not a substring.
    return (
      /@lid\b/.test(body) ||
      /\blid\b/.test(body) ||
      body.includes('presence') ||
      body.includes('composing')
    );
  }

  private toEvolutionNumber(e164: string): string {
    return e164.replace(/\D/g, '');
  }

  private toRemoteJid(e164: string): string {
    return `${this.toEvolutionNumber(e164)}@s.whatsapp.net`;
  }
}
