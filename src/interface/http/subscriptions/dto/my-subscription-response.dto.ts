import { ApiProperty } from '@nestjs/swagger';

import { MySubscriptionResult } from '@application/subscriptions/use-cases/get-my-subscription.use-case';
import { MoneyResponseDto } from '@interface/http/common/dto/money-response.dto';
import { SubscriptionStatus } from '@domain/subscriptions/value-objects/subscription-status.vo';

class UsageMeterDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  used: number;

  @ApiProperty({ nullable: true, type: Number })
  limit: number | null;

  @ApiProperty({ nullable: true, type: Number })
  remaining: number | null;
}

class PlanSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;
}

export class MySubscriptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiProperty()
  currentPeriodStart: string;

  @ApiProperty()
  currentPeriodEnd: string;

  @ApiProperty({ type: MoneyResponseDto })
  price: MoneyResponseDto;

  @ApiProperty({ type: PlanSummaryDto })
  plan: PlanSummaryDto;

  @ApiProperty({ type: Object })
  config: Record<string, unknown>;

  @ApiProperty({ type: [UsageMeterDto] })
  quotas: UsageMeterDto[];

  @ApiProperty({ type: [UsageMeterDto] })
  caps: UsageMeterDto[];

  @ApiProperty({ type: Object })
  features: MySubscriptionResult['features'];

  static from(result: MySubscriptionResult): MySubscriptionResponseDto {
    return {
      id: result.id,
      status: result.status,
      currentPeriodStart: result.currentPeriodStart.toISOString(),
      currentPeriodEnd: result.currentPeriodEnd.toISOString(),
      price: MoneyResponseDto.from(result.price),
      plan: result.plan,
      config: result.config as unknown as Record<string, unknown>,
      quotas: result.quotas,
      caps: result.caps,
      features: result.features,
    };
  }
}
