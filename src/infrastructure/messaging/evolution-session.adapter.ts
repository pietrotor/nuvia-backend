import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ErrorCode, InternalError } from '@domain/common/exceptions';
import {
  CreateWhatsAppSessionInput,
  WhatsAppSessionPort,
  WhatsAppSessionQr,
  WhatsAppSessionStatus,
} from '@domain/messaging/ports/whatsapp-session.port';
import { EvolutionApiClient } from './evolution-api.client';

interface EvolutionCreateResponse {
  instance: {
    instanceId: string;
    instanceName: string;
  };
  hash?: string;
  qrcode?: {
    base64?: string;
    pairingCode?: string;
    code?: string;
  };
}

interface EvolutionQrResponse {
  base64?: string;
  pairingCode?: string;
  code?: string;
  qrcode?: {
    base64?: string;
    pairingCode?: string;
    code?: string;
  };
}

interface EvolutionInstanceResponse {
  id: string;
  name: string;
  connectionStatus: string;
  ownerJid?: string | null;
}

@Injectable()
export class EvolutionSessionAdapter implements WhatsAppSessionPort {
  constructor(
    private readonly client: EvolutionApiClient,
    private readonly config: ConfigService,
  ) {}

  async createSession(
    input: CreateWhatsAppSessionInput,
  ): Promise<WhatsAppSessionQr> {
    const created = await this.client.post<EvolutionCreateResponse>(
      '/instance/create',
      {
        instanceName: input.instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        rejectCall: true,
        msgCall: 'Este número no recibe llamadas. Escribinos por WhatsApp.',
        groupsIgnore: true,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      },
    );

    try {
      await this.configureWebhook(input.instanceName);
    } catch (error) {
      await this.client
        .delete(`/instance/delete/${encodeURIComponent(input.instanceName)}`, [
          404,
        ])
        .catch(() => undefined);
      throw error;
    }

    return {
      instanceId: created.instance.instanceId,
      instanceName: created.instance.instanceName,
      qrBase64: created.qrcode?.base64,
      pairingCode: created.qrcode?.pairingCode ?? created.qrcode?.code,
      webhookToken: created.hash,
    };
  }

  async getQr(instanceName: string): Promise<WhatsAppSessionQr> {
    const response = await this.client.get<EvolutionQrResponse>(
      `/instance/connect/${encodeURIComponent(instanceName)}`,
    );
    return {
      instanceId: instanceName,
      instanceName,
      qrBase64: response.base64 ?? response.qrcode?.base64,
      pairingCode:
        response.pairingCode ??
        response.code ??
        response.qrcode?.pairingCode ??
        response.qrcode?.code,
    };
  }

  // connectionState only reports the state, so we read the instance record
  // instead: it also carries the linked phone number.
  async getStatus(instanceName: string): Promise<WhatsAppSessionStatus> {
    const instances = await this.client.get<EvolutionInstanceResponse[]>(
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
    );
    const instance = instances?.find((item) => item.name === instanceName);
    if (!instance) {
      return { instanceId: instanceName, instanceName, connected: false };
    }

    return {
      instanceId: instance.id,
      instanceName: instance.name,
      connected: instance.connectionStatus === 'open',
      phoneNumber: this.phoneFromJid(instance.ownerJid),
    };
  }

  // Evolution refuses to delete an instance it still believes is open, and the
  // logout call fails outright when the socket is already dead. Both steps are
  // therefore best-effort so the owner can always start over.
  async disconnect(instanceName: string): Promise<void> {
    await this.client
      .delete(
        `/instance/logout/${encodeURIComponent(instanceName)}`,
        [400, 404, 500],
      )
      .catch(() => undefined);

    await this.client
      .delete(
        `/instance/delete/${encodeURIComponent(instanceName)}`,
        [400, 404],
      )
      .catch(() => undefined);
  }

  private async configureWebhook(instanceName: string): Promise<void> {
    const url = this.config.get<string>('WEBHOOK_PUBLIC_URL');
    const webhookSecret = this.config.get<string>('WEBHOOK_SECRET');
    if (!url || !webhookSecret) {
      throw new InternalError(ErrorCode.MESSAGING_NOT_CONFIGURED);
    }

    await this.client.post(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: false,
        headers: { 'x-webhook-secret': webhookSecret },
        // LABELS_ASSOCIATION lets the owner pause/resume the bot by tagging a chat
        // from her phone; CONNECTION_UPDATE triggers label provisioning on connect.
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'LABELS_ASSOCIATION'],
      },
    });
  }

  private phoneFromJid(ownerJid?: string | null): string | undefined {
    const digits = ownerJid?.split('@')[0]?.replace(/\D/g, '');
    return digits ? `+${digits}` : undefined;
  }
}
