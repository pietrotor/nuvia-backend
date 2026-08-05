import { ApiProperty } from '@nestjs/swagger';

import { ServiceSummary } from '@domain/services/views/service-summary';

import { MoneyResponseDto } from '@interface/http/common/dto/money-response.dto';

export class ServiceSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  durationMinutes: number;

  @ApiProperty({ type: MoneyResponseDto })
  price: MoneyResponseDto;

  @ApiProperty()
  requiresDeposit: boolean;

  static from(service: ServiceSummary): ServiceSummaryResponseDto {
    return {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      price: MoneyResponseDto.from(service.price),
      requiresDeposit: service.requiresDeposit,
    };
  }
}
