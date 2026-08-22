import { Inject, Injectable } from '@nestjs/common';

import { EVOLUTION_REQUEST_TIMEOUT_MS } from './evolution-api.client';
import { EvolutionMessagingAdapter } from './evolution-messaging.adapter';
import { OutboundSafetyGate } from './outbound-safety.gate';
import {
  DownloadInboundMediaInput,
  InboundMedia,
  MarkAsReadInput,
  MessagingPort,
  OutboundClass,
  SendMediaMessageInput,
  SendTextMessageInput,
  SentMessage,
  ShowTypingInput,
} from '@domain/messaging/ports/messaging.port';

export const EVOLUTION_MESSAGING_ADAPTER = 'EvolutionMessagingAdapter';

@Injectable()
export class GatedMessagingAdapter implements MessagingPort {
  constructor(
    @Inject(EVOLUTION_MESSAGING_ADAPTER)
    private readonly inner: EvolutionMessagingAdapter,
    private readonly gate: OutboundSafetyGate,
  ) {}

  async sendText(input: SendTextMessageInput): Promise<SentMessage> {
    const outboundClass = input.outboundClass ?? OutboundClass.AGENT_REPLY;
    const holdMs =
      EVOLUTION_REQUEST_TIMEOUT_MS + (input.typingDelayMs ?? 0) + 5_000;
    const lease = await this.gate.acquire({
      tenantId: input.tenantId,
      outboundClass,
      holdMs,
    });
    try {
      const sent = await this.inner.sendText(input);
      await this.gate.noteSuccess(lease);
      return sent;
    } catch (error) {
      await this.gate.noteProviderError(input.tenantId, error);
      throw error;
    } finally {
      await this.gate.release(lease);
    }
  }

  async sendMedia(input: SendMediaMessageInput): Promise<SentMessage> {
    const outboundClass = input.outboundClass ?? OutboundClass.TRANSACTIONAL;
    const lease = await this.gate.acquire({
      tenantId: input.tenantId,
      outboundClass,
      holdMs: EVOLUTION_REQUEST_TIMEOUT_MS + 5_000,
    });
    try {
      const sent = await this.inner.sendMedia(input);
      await this.gate.noteSuccess(lease);
      return sent;
    } catch (error) {
      await this.gate.noteProviderError(input.tenantId, error);
      throw error;
    } finally {
      await this.gate.release(lease);
    }
  }

  markAsRead(input: MarkAsReadInput): Promise<void> {
    return this.inner.markAsRead(input);
  }

  showTyping(input: ShowTypingInput): Promise<void> {
    return this.inner.showTyping(input);
  }

  downloadInboundMedia(
    input: DownloadInboundMediaInput,
  ): Promise<InboundMedia> {
    return this.inner.downloadInboundMedia(input);
  }
}
