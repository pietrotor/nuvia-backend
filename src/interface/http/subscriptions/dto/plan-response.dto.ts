import { ApiProperty } from '@nestjs/swagger';

import { Plan } from '@domain/subscriptions/entities/plan.entity';
import { MoneyResponseDto } from '@interface/http/common/dto/money-response.dto';

export class PlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: MoneyResponseDto })
  price: MoneyResponseDto;

  @ApiProperty()
  billingPeriodMonths: number;

  @ApiProperty({ type: Object })
  config: Record<string, unknown>;

  static from(plan: Plan): PlanResponseDto {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      isActive: plan.isActive,
      price: MoneyResponseDto.from(plan.price),
      billingPeriodMonths: plan.billingPeriodMonths,
      config: plan.config as Record<string, unknown>,
    };
  }
}
