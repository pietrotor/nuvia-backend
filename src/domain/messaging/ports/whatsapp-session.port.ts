export interface CreateWhatsAppSessionInput {
  tenantId: string;
  instanceName: string;
}

export interface WhatsAppSessionQr {
  instanceId: string;
  instanceName: string;
  qrBase64?: string;
  pairingCode?: string;
  webhookToken?: string;
}

export interface WhatsAppSessionStatus {
  instanceId: string;
  instanceName: string;
  connected: boolean;
  phoneNumber?: string;
}

export interface WhatsAppSessionPort {
  createSession(input: CreateWhatsAppSessionInput): Promise<WhatsAppSessionQr>;
  getQr(instanceName: string): Promise<WhatsAppSessionQr>;
  getStatus(instanceName: string): Promise<WhatsAppSessionStatus>;
  disconnect(instanceName: string): Promise<void>;
}

export const WHATSAPP_SESSION_PORT = 'WhatsAppSessionPort';
