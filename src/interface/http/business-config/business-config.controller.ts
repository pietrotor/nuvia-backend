import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import { UpdateBusinessConfigUseCase } from '@application/business-config/use-cases/update-business-config.use-case';
import { UpdateBusinessConfigDto } from '@application/business-config/dto/update-business-config.dto';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { BusinessConfigResponseDto } from './dto/business-config-response.dto';

@ApiTags('Business config')
@ApiBearerAuth()
@Controller('business-config')
export class BusinessConfigController {
  constructor(
    private readonly getBusinessConfig: GetBusinessConfigUseCase,
    private readonly updateBusinessConfig: UpdateBusinessConfigUseCase,
  ) {}

  // Staff reads it for bookingPolicy (deposit warnings) and agent settings.
  // Location and hours live on branches — see GET /branches.
  @Get()
  @Auth(Permission.BUSINESS_CONFIG_READ)
  @ApiOperation({
    summary: 'Gets the business configuration',
    description:
      'Address and weekly hours live on branches (GET /branches), not on business config.',
  })
  @ApiResponse({ status: 200, type: BusinessConfigResponseDto })
  async get(): Promise<BusinessConfigResponseDto> {
    return BusinessConfigResponseDto.from(
      await this.getBusinessConfig.execute(),
    );
  }

  @Patch()
  @Auth(Permission.BUSINESS_CONFIG_WRITE)
  @ApiOperation({ summary: 'Updates the business configuration' })
  @ApiResponse({ status: 200, type: BusinessConfigResponseDto })
  async update(
    @Body() dto: UpdateBusinessConfigDto,
  ): Promise<BusinessConfigResponseDto> {
    return BusinessConfigResponseDto.from(
      await this.updateBusinessConfig.execute(dto),
    );
  }
}
