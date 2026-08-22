import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import {
  AgentTone,
  EmojiPolicy,
} from '@domain/business-config/entities/business-config.entity';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { DEFAULT_COUNTRY_CODE } from '@domain/common/value-objects/country-code.vo';
import {
  CLIENT_REMINDER_OFFSET_CATALOG,
  ClientReminderOffset,
  MAX_CLIENT_REMINDER_OFFSETS,
} from '@domain/business-config/value-objects/client-reminder-policy.vo';

export class BookingPolicyDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  @Max(720)
  minLeadTimeHours: number;

  @ApiProperty({ example: 24 })
  @IsInt()
  @Min(0)
  @Max(720)
  cancelRescheduleHours: number;

  @ApiProperty({ example: 'Avisanos con anticipación si no podés asistir.' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  noShowMessage: string;
}

export class AgentPolicyDto {
  @ApiProperty({
    example: 60,
    description:
      'Minutes of staff silence after pause before inbound can auto-resume the bot. 0 disables auto-resume.',
  })
  @IsInt()
  @Min(0)
  @Max(10_080)
  handoffAutoResumeMinutes: number;

  @ApiProperty({
    enum: EmojiPolicy,
    required: false,
    description: 'How many emojis the agent may use per message',
  })
  @IsOptional()
  @IsEnum(EmojiPolicy)
  emojiPolicy?: EmojiPolicy;

  @ApiProperty({
    required: false,
    nullable: true,
    example:
      'Estacionamiento sobre la calle lateral. Atendemos con cita previa.',
    description:
      'Business facts the agent may mention. Data, not instructions: platform rules always win',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessNotes?: string | null;

  @ApiProperty({
    required: false,
    example: false,
    description:
      'Mirror the handoff (bot paused) state onto a WhatsApp Business label and honour the owner adding/removing it from her phone. Opt-in per tenant.',
  })
  @IsOptional()
  @IsBoolean()
  humanAttentionLabelSync?: boolean;

  @ApiProperty({
    required: false,
    example: 'Requiere atención humana',
    description: 'Owner-facing text of the human-attention label',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  humanAttentionLabelName?: string;
}

export class ClientReminderPolicyDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    enum: CLIENT_REMINDER_OFFSET_CATALOG,
    isArray: true,
    example: ['24h', '2h'],
    description: 'Closed catalog; at most three unique offsets',
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_CLIENT_REMINDER_OFFSETS)
  @IsIn([...CLIENT_REMINDER_OFFSET_CATALOG], { each: true })
  offsets: ClientReminderOffset[];

  @ApiProperty({ example: false })
  @IsBoolean()
  thankYouAfterVisit: boolean;
}

export class UpdateBusinessConfigDto {
  @ApiProperty({ example: 'estetica-glow', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  slug?: string;

  @ApiProperty({ example: 'Vale', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  agentName?: string;

  @ApiProperty({ enum: AgentTone, required: false })
  @IsOptional()
  @IsEnum(AgentTone)
  tone?: AgentTone;

  @ApiProperty({
    enum: Currency,
    required: false,
    description: 'Currency new services are priced in',
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({
    example: DEFAULT_COUNTRY_CODE,
    required: false,
    description:
      'ISO 3166-1 alpha-2 country for default phone parsing and display',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  countryCode?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string | null;

  @ApiProperty({ example: '+59170000000', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappPhone?: string | null;

  @ApiProperty({ type: BookingPolicyDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => BookingPolicyDto)
  bookingPolicy?: BookingPolicyDto;

  @ApiProperty({ type: AgentPolicyDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => AgentPolicyDto)
  agentPolicy?: AgentPolicyDto;

  @ApiProperty({ type: ClientReminderPolicyDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClientReminderPolicyDto)
  clientReminderPolicy?: ClientReminderPolicyDto;

  @ApiProperty({ required: false, example: { pagos: 'Aceptamos QR.' } })
  @IsOptional()
  @IsObject()
  faq?: Record<string, string>;
}
