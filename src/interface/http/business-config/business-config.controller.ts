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
import { Role } from '@domain/users/value-objects/role.vo';
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

  @Get()
  @Auth(Role.OWNER)
  @ApiOperation({ summary: 'Gets the business configuration' })
  @ApiResponse({ status: 200, type: BusinessConfigResponseDto })
  async get(): Promise<BusinessConfigResponseDto> {
    return BusinessConfigResponseDto.from(
      await this.getBusinessConfig.execute(),
    );
  }

  @Patch()
  @Auth(Role.OWNER)
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
