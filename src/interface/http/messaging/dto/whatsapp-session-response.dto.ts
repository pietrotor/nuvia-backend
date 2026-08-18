import { ApiProperty } from '@nestjs/swagger';

import { WhatsAppStatusResult } from '@application/messaging/use-cases/get-whatsapp-status.use-case';
import { WhatsAppSessionQr } from '@domain/messaging/ports/whatsapp-session.port';

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
  @ApiProperty({
    description:
      'True when the tenant has an Evolution instance identity stored (may still be offline).',
  })
  configured: boolean;

  @ApiProperty({
    description: 'True when the live WhatsApp socket is open.',
  })
  connected: boolean;

  @ApiProperty({ required: false })
  phoneNumber?: string;

  static from(status: WhatsAppStatusResult): WhatsAppStatusResponseDto {
    return {
      configured: status.configured,
      connected: status.connected,
      phoneNumber: status.phoneNumber,
    };
  }
}
