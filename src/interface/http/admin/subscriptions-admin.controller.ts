import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ChangeSubscriptionPlanUseCase } from '@application/subscriptions/use-cases/change-subscription-plan.use-case';
import { CreatePlanUseCase } from '@application/subscriptions/use-cases/create-plan.use-case';
import { CreateSubscriptionUseCase } from '@application/subscriptions/use-cases/create-subscription.use-case';
import { ListPlansUseCase } from '@application/subscriptions/use-cases/list-plans.use-case';
import { RenewSubscriptionUseCase } from '@application/subscriptions/use-cases/renew-subscription.use-case';
import { UpdatePlanUseCase } from '@application/subscriptions/use-cases/update-plan.use-case';
import { UpdateSubscriptionUseCase } from '@application/subscriptions/use-cases/update-subscription.use-case';
import { PartialPlanConfig } from '@domain/subscriptions/value-objects/plan-config.vo';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '../common/decorators';
import { PlanResponseDto } from '../subscriptions/dto/plan-response.dto';
import {
  ChangeSubscriptionPlanBodyDto,
  CreatePlanBodyDto,
  CreateSubscriptionBodyDto,
  RenewSubscriptionBodyDto,
  UpdatePlanBodyDto,
  UpdateSubscriptionBodyDto,
} from './dto/subscription-admin.dto';

@ApiTags('Admin')
@Controller('admin')
export class SubscriptionsAdminController {
  constructor(
    private readonly listPlans: ListPlansUseCase,
    private readonly createPlan: CreatePlanUseCase,
    private readonly updatePlan: UpdatePlanUseCase,
    private readonly createSubscription: CreateSubscriptionUseCase,
    private readonly renewSubscription: RenewSubscriptionUseCase,
    private readonly changeSubscriptionPlan: ChangeSubscriptionPlanUseCase,
    private readonly updateSubscription: UpdateSubscriptionUseCase,
  ) {}

  @Get('plans')
  @Auth(Permission.SUBSCRIPTIONS_ADMIN)
  @ApiOperation({ summary: 'Lists SaaS plans' })
  @ApiResponse({ status: 200, type: [PlanResponseDto] })
  async plans(): Promise<PlanResponseDto[]> {
    return (await this.listPlans.execute()).map(PlanResponseDto.from);
  }

  @Post('plans')
  @Auth(Permission.SUBSCRIPTIONS_ADMIN)
  @ApiOperation({ summary: 'Creates a SaaS plan' })
  @ApiResponse({ status: 201, type: PlanResponseDto })
  async createPlanEndpoint(
    @Body() body: CreatePlanBodyDto,
  ): Promise<PlanResponseDto> {
    return PlanResponseDto.from(
      await this.createPlan.execute({
        ...body,
        config: body.config as PartialPlanConfig | undefined,
      }),
    );
  }

  @Patch('plans/:id')
  @Auth(Permission.SUBSCRIPTIONS_ADMIN)
  @ApiOperation({ summary: 'Updates a SaaS plan' })
  @ApiResponse({ status: 200, type: PlanResponseDto })
  async updatePlanEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePlanBodyDto,
  ): Promise<PlanResponseDto> {
    return PlanResponseDto.from(
      await this.updatePlan.execute(id, {
        ...body,
        config: body.config as PartialPlanConfig | undefined,
      }),
    );
  }

  @Post('tenants/:tenantId/subscriptions')
  @Auth(Permission.SUBSCRIPTIONS_ADMIN)
  @ApiOperation({ summary: 'Creates a subscription for a tenant' })
  async createSubscriptionEndpoint(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: CreateSubscriptionBodyDto,
  ) {
    const created = await this.createSubscription.execute({
      tenantId,
      planId: body.planId,
      status: body.status,
      currentPeriodStart: body.currentPeriodStart
        ? new Date(body.currentPeriodStart)
        : undefined,
      currentPeriodEnd: body.currentPeriodEnd
        ? new Date(body.currentPeriodEnd)
        : undefined,
      configOverrides: body.configOverrides as PartialPlanConfig | undefined,
      notes: body.notes,
    });
    return {
      id: created.id,
      tenantId: created.tenantId,
      planId: created.planId,
      status: created.status,
      currentPeriodStart: created.currentPeriodStart.toISOString(),
      currentPeriodEnd: created.currentPeriodEnd.toISOString(),
    };
  }

  @Post('tenants/:tenantId/subscriptions/renew')
  @Auth(Permission.SUBSCRIPTIONS_ADMIN)
  @ApiOperation({ summary: 'Renews the current tenant subscription period' })
  async renewSubscriptionEndpoint(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: RenewSubscriptionBodyDto,
  ) {
    const renewed = await this.renewSubscription.execute({
      tenantId,
      planId: body.planId,
      periodStart: body.periodStart ? new Date(body.periodStart) : undefined,
      periodEnd: body.periodEnd ? new Date(body.periodEnd) : undefined,
    });
    return {
      id: renewed.id,
      planId: renewed.planId,
      status: renewed.status,
      currentPeriodStart: renewed.currentPeriodStart.toISOString(),
      currentPeriodEnd: renewed.currentPeriodEnd.toISOString(),
    };
  }

  @Post('tenants/:tenantId/subscriptions/change-plan')
  @Auth(Permission.SUBSCRIPTIONS_ADMIN)
  @ApiOperation({ summary: 'Changes the plan of the current subscription' })
  async changePlanEndpoint(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: ChangeSubscriptionPlanBodyDto,
  ) {
    const updated = await this.changeSubscriptionPlan.execute({
      tenantId,
      planId: body.planId,
    });
    return {
      id: updated.id,
      planId: updated.planId,
      status: updated.status,
    };
  }

  @Patch('tenants/:tenantId/subscriptions')
  @Auth(Permission.SUBSCRIPTIONS_ADMIN)
  @ApiOperation({
    summary: 'Updates subscription status or negotiated overrides',
  })
  async updateSubscriptionEndpoint(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: UpdateSubscriptionBodyDto,
  ) {
    const updated = await this.updateSubscription.execute({
      tenantId,
      status: body.status,
      configOverrides:
        body.configOverrides === undefined
          ? undefined
          : (body.configOverrides as PartialPlanConfig | null),
      notes: body.notes,
    });
    return {
      id: updated.id,
      status: updated.status,
      configOverrides: updated.configOverrides,
    };
  }
}
