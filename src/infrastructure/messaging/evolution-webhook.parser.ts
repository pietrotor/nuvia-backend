import { Injectable } from '@nestjs/common';

import { MessageKind } from '@domain/conversations/entities/message.entity';

export interface ParsedInboundMessage {
  providerMessageId: string;
  clientPhoneE164: string;
  clientName: string;
  kind: MessageKind;
  content: string | null;
  inReplyToProviderMessageId: string | null;
  occurredAt: Date;
}

export interface ParsedMessageStatus {
  providerMessageId: string;
  status: string;
  statusCode: number | null;
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
    const image = this.isRecord(message.imageMessage)
      ? message.imageMessage
      : {};
    const content =
      typeof message.conversation === 'string'
        ? message.conversation
        : typeof extended.text === 'string'
          ? extended.text
          : typeof image.caption === 'string'
            ? image.caption
            : null;
    const inReplyToProviderMessageId = this.quotedMessageId(data, message);
    const providerKind = this.resolveKind(data.messageType);

    return {
      providerMessageId,
      clientPhoneE164: `+${phone}`,
      clientName:
        typeof data.pushName === 'string' && data.pushName.trim()
          ? data.pushName.trim()
          : `Cliente ${phone.slice(-4)}`,
      kind:
        providerKind === MessageKind.OTHER && content
          ? MessageKind.TEXT
          : providerKind,
      content,
      inReplyToProviderMessageId,
      occurredAt: this.resolveTimestamp(data.messageTimestamp),
    };
  }

  parseStatusUpdates(payload: unknown): ParsedMessageStatus[] {
    if (!this.isRecord(payload)) return [];
    const data = payload.data;
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    return rows.flatMap((row) => {
      if (!this.isRecord(row)) return [];
      const key = this.isRecord(row.key) ? row.key : null;
      const providerMessageId =
        (typeof row.keyId === 'string' && row.keyId) ||
        (typeof key?.id === 'string' && key.id) ||
        (typeof row.id === 'string' && row.id) ||
        null;
      if (!providerMessageId) return [];
      const status = String(
        row.status ?? row.update ?? row.messageStatus ?? '',
      );
      const statusCodeRaw = row.statusCode ?? row.status_code ?? row.code;
      const statusCode =
        typeof statusCodeRaw === 'number'
          ? statusCodeRaw
          : Number.parseInt(String(statusCodeRaw ?? ''), 10);
      return [
        {
          providerMessageId,
          status,
          statusCode: Number.isFinite(statusCode) ? statusCode : null,
        },
      ];
    });
  }

  private resolveKind(messageType: unknown): MessageKind {
    const type = String(messageType ?? '').toLowerCase();
    if (type.includes('audio')) return MessageKind.AUDIO;
    if (type.includes('image')) return MessageKind.IMAGE;
    return MessageKind.OTHER;
  }

  private quotedMessageId(
    data: Record<string, unknown>,
    message: Record<string, unknown>,
  ): string | null {
    const candidates = [
      data.contextInfo,
      this.nestedContext(message, 'extendedTextMessage'),
      this.nestedContext(message, 'imageMessage'),
      this.nestedContext(message, 'documentMessage'),
      this.nestedContext(message, 'audioMessage'),
      this.nestedContext(message, 'videoMessage'),
    ];
    for (const candidate of candidates) {
      if (!this.isRecord(candidate)) continue;
      if (typeof candidate.stanzaId === 'string' && candidate.stanzaId) {
        return candidate.stanzaId;
      }
    }
    return null;
  }

  private nestedContext(
    message: Record<string, unknown>,
    key: string,
  ): unknown {
    const body = message[key];
    return this.isRecord(body) ? body.contextInfo : null;
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
