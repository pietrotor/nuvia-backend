import { ApiProperty } from '@nestjs/swagger';

import {
  WhatsAppSessionQr,
  WhatsAppSessionStatus,
} from '@domain/messaging/ports/whatsapp-session.port';

export class WhatsAppQrResponseDto {
  @ApiProperty({ required: false })
  qrBase64?: string;

  @ApiProperty({ required: false })
  pairingCode?: string;

  static from(session: WhatsAppSessionQr): WhatsAppQrResponseDto {
    return {
      qrBase64: session.qrBase64,
      pairingCode: session.pairingCode,
    };
  }
}

export class WhatsAppStatusResponseDto {
  @ApiProperty()
  connected: boolean;

  @ApiProperty({ required: false })
  phoneNumber?: string;

  static from(status: WhatsAppSessionStatus): WhatsAppStatusResponseDto {
    return {
      connected: status.connected,
      phoneNumber: status.phoneNumber,
    };
  }
}
