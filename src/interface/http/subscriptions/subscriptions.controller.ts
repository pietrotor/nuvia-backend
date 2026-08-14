import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { GetMySubscriptionUseCase } from '@application/subscriptions/use-cases/get-my-subscription.use-case';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '../common/decorators';
import { MySubscriptionResponseDto } from './dto/my-subscription-response.dto';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly getMySubscription: GetMySubscriptionUseCase) {}

  @Get('me')
  @Auth(Permission.SUBSCRIPTION_READ)
  @ApiOperation({ summary: 'Gets the current tenant subscription and usage' })
  @ApiResponse({ status: 200, type: MySubscriptionResponseDto })
  async me(): Promise<MySubscriptionResponseDto> {
    return MySubscriptionResponseDto.from(
      await this.getMySubscription.execute(),
    );
  }
}
