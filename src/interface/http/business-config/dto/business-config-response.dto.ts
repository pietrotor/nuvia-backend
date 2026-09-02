import { ApiProperty } from '@nestjs/swagger';

import {
  AgentTone,
  AgentPolicy,
  BookingPolicy,
  BusinessConfig,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessCategory } from '@domain/business-config/value-objects/business-category.vo';
import { ClientReminderPolicy } from '@domain/business-config/value-objects/client-reminder-policy.vo';
import { CurrencyResponseDto } from '@interface/http/common/dto/money-response.dto';
import { DEFAULT_COUNTRY_CODE } from '@domain/common/value-objects/country-code.vo';
import { CategoryLexiconResponseDto } from './category-lexicon-response.dto';

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

  @ApiProperty({ type: CategoryLexiconResponseDto })
  lexicon: CategoryLexiconResponseDto;

  @ApiProperty({ type: CurrencyResponseDto })
  currency: CurrencyResponseDto;

  @ApiProperty({
    example: DEFAULT_COUNTRY_CODE,
    description:
      'ISO 3166-1 alpha-2 country for default phone parsing and display',
  })
  countryCode: string;

  @ApiProperty({ nullable: true })
  logoUrl: string | null;

  @ApiProperty({ nullable: true })
  whatsappPhone: string | null;

  @ApiProperty({ type: Object })
  bookingPolicy: BookingPolicy;

  @ApiProperty({ type: Object })
  agentPolicy: AgentPolicy;

  @ApiProperty({ type: Object })
  clientReminderPolicy: ClientReminderPolicy;

  @ApiProperty({ type: Object })
  faq: Record<string, string>;

  @ApiProperty()
  whatsappConnected: boolean;

  static from(config: BusinessConfig): BusinessConfigResponseDto {
    return {
      id: config.id,
      slug: config.slug,
      agentName: config.agentName,
      tone: config.tone,
      businessCategory: config.businessCategory,
      lexicon: CategoryLexiconResponseDto.from(config.businessCategory),
      currency: CurrencyResponseDto.from(config.currency),
      countryCode: config.countryCode,
      logoUrl: config.logoUrl,
      whatsappPhone: config.whatsappPhone,
      bookingPolicy: config.bookingPolicy,
      agentPolicy: config.agentPolicy,
      clientReminderPolicy: config.clientReminderPolicy,
      faq: config.faq,
      whatsappConnected: config.canSendMessages(),
    };
  }
}
