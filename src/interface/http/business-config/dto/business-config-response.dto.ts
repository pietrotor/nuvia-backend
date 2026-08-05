import { ApiProperty } from '@nestjs/swagger';

import {
  AgentTone,
  AgentPolicy,
  BookingPolicy,
  BusinessConfig,
  WeeklyHours,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessCategory } from '@domain/business-config/value-objects/business-category.vo';
import { CurrencyResponseDto } from '@interface/http/common/dto/money-response.dto';

export class BusinessConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  agentName: string;

  @ApiProperty({ enum: AgentTone })
  tone: AgentTone;

  @ApiProperty({
    enum: BusinessCategory,
    description: 'Read-only for the owner: support assigns it',
  })
  businessCategory: BusinessCategory;

  @ApiProperty({ type: CurrencyResponseDto })
  currency: CurrencyResponseDto;

  @ApiProperty({ nullable: true })
  address: string | null;

  @ApiProperty({ nullable: true })
  logoUrl: string | null;

  @ApiProperty({ nullable: true })
  whatsappPhone: string | null;

  @ApiProperty({ type: Object })
  businessHours: WeeklyHours;

  @ApiProperty({ type: Object })
  bookingPolicy: BookingPolicy;

  @ApiProperty({ type: Object })
  agentPolicy: AgentPolicy;

  @ApiProperty({ type: Object })
  faq: Record<string, string>;

  @ApiProperty({ nullable: true })
  staticDepositQrUrl: string | null;

  @ApiProperty()
  whatsappConnected: boolean;

  static from(config: BusinessConfig): BusinessConfigResponseDto {
    return {
      id: config.id,
      slug: config.slug,
      agentName: config.agentName,
      tone: config.tone,
      businessCategory: config.businessCategory,
      currency: CurrencyResponseDto.from(config.currency),
      address: config.address,
      logoUrl: config.logoUrl,
      whatsappPhone: config.whatsappPhone,
      businessHours: config.businessHours,
      bookingPolicy: config.bookingPolicy,
      agentPolicy: config.agentPolicy,
      faq: config.faq,
      staticDepositQrUrl: config.staticDepositQrUrl,
      whatsappConnected: config.canSendMessages(),
    };
  }
}
