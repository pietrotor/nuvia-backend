import { Injectable } from '@nestjs/common';

import { MessageKind } from '@domain/conversations/entities/message.entity';

export interface ParsedInboundMessage {
  providerMessageId: string;
  clientPhoneE164: string;
  clientName: string;
  kind: MessageKind;
  content: string | null;
  occurredAt: Date;
}

@Injectable()
export class EvolutionWebhookParser {
  parse(payload: unknown): ParsedInboundMessage | null {
    if (!this.isRecord(payload)) return null;
    const data = this.isRecord(payload.data) ? payload.data : null;
    const key = data && this.isRecord(data.key) ? data.key : null;
    if (!data || !key || key.fromMe === true) return null;

    const remoteJid =
      typeof key.remoteJidAlt === 'string' &&
      String(key.remoteJid).includes('@lid')
        ? key.remoteJidAlt
        : key.remoteJid;
    if (
      typeof remoteJid !== 'string' ||
      remoteJid.includes('@g.us') ||
      remoteJid === 'status@broadcast'
    ) {
      return null;
    }

    const providerMessageId = typeof key.id === 'string' ? key.id : undefined;
    const phone = remoteJid.split('@')[0]?.replace(/\D/g, '');
    if (!providerMessageId || !phone) return null;

    const message = this.isRecord(data.message) ? data.message : {};
    const extended = this.isRecord(message.extendedTextMessage)
      ? message.extendedTextMessage
      : {};
    const content =
      typeof message.conversation === 'string'
        ? message.conversation
        : typeof extended.text === 'string'
          ? extended.text
          : null;

    return {
      providerMessageId,
      clientPhoneE164: `+${phone}`,
      clientName:
        typeof data.pushName === 'string' && data.pushName.trim()
          ? data.pushName.trim()
          : `Cliente ${phone.slice(-4)}`,
      kind: content ? MessageKind.TEXT : this.resolveKind(data.messageType),
      content,
      occurredAt: this.resolveTimestamp(data.messageTimestamp),
    };
  }

  private resolveKind(messageType: unknown): MessageKind {
    const type = String(messageType ?? '').toLowerCase();
    if (type.includes('audio')) return MessageKind.AUDIO;
    if (type.includes('image')) return MessageKind.IMAGE;
    return MessageKind.OTHER;
  }

  private resolveTimestamp(timestamp: unknown): Date {
    const seconds = Number(timestamp);
    const date = new Date(seconds * 1000);
    return Number.isFinite(seconds) && !Number.isNaN(date.getTime())
      ? date
      : new Date();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
