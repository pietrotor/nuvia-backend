import { ApiProperty } from '@nestjs/swagger';

import { Service } from '@domain/services/entities/service.entity';

import { MoneyResponseDto } from '@interface/http/common/dto/money-response.dto';

export class ServiceResponseDto {
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

  @ApiProperty({ type: MoneyResponseDto, nullable: true })
  depositAmount: MoneyResponseDto | null;

  @ApiProperty({ nullable: true })
  depositPercent: number | null;

  @ApiProperty({ type: [String] })
  professionalIds: string[];

  @ApiProperty()
  isActive: boolean;

  static from(service: Service): ServiceResponseDto {
    return {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      price: MoneyResponseDto.from(service.price),
      requiresDeposit: service.requiresDeposit,
      depositAmount: service.depositAmount
        ? MoneyResponseDto.from(service.depositAmount)
        : null,
      depositPercent: service.depositPercent,
      professionalIds: service.professionalIds,
      isActive: service.isActive,
    };
  }
}
