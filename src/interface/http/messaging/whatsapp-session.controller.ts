import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateWhatsAppSessionUseCase } from '@application/messaging/use-cases/create-whatsapp-session.use-case';
import { DisconnectWhatsAppSessionUseCase } from '@application/messaging/use-cases/disconnect-whatsapp-session.use-case';
import { GetWhatsAppQrUseCase } from '@application/messaging/use-cases/get-whatsapp-qr.use-case';
import { GetWhatsAppStatusUseCase } from '@application/messaging/use-cases/get-whatsapp-status.use-case';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import {
  WhatsAppQrResponseDto,
  WhatsAppStatusResponseDto,
} from './dto/whatsapp-session-response.dto';

@ApiTags('WhatsApp session')
@ApiBearerAuth()
@Controller('whatsapp-session')
export class WhatsAppSessionController {
  constructor(
    private readonly createSession: CreateWhatsAppSessionUseCase,
    private readonly getQr: GetWhatsAppQrUseCase,
    private readonly getStatus: GetWhatsAppStatusUseCase,
    private readonly disconnectSession: DisconnectWhatsAppSessionUseCase,
  ) {}

  @Post()
  @Auth(Permission.WHATSAPP_MANAGE)
  @ApiOperation({ summary: 'Creates a session and returns the pairing QR' })
  @ApiResponse({ status: 201, type: WhatsAppQrResponseDto })
  async create(): Promise<WhatsAppQrResponseDto> {
    return WhatsAppQrResponseDto.from(await this.createSession.execute());
  }

  @Get('qr')
  @Auth(Permission.WHATSAPP_MANAGE)
  @ApiOperation({ summary: 'Refreshes the pairing QR' })
  @ApiResponse({ status: 200, type: WhatsAppQrResponseDto })
  async qr(): Promise<WhatsAppQrResponseDto> {
    return WhatsAppQrResponseDto.from(await this.getQr.execute());
  }

  @Get('status')
  @Auth(Permission.WHATSAPP_MANAGE)
  @ApiOperation({ summary: 'Checks the WhatsApp status' })
  @ApiResponse({ status: 200, type: WhatsAppStatusResponseDto })
  async status(): Promise<WhatsAppStatusResponseDto> {
    return WhatsAppStatusResponseDto.from(await this.getStatus.execute());
  }

  @Delete()
  @Auth(Permission.WHATSAPP_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlinks WhatsApp from the business' })
  async disconnect(): Promise<void> {
    await this.disconnectSession.execute();
  }
}
