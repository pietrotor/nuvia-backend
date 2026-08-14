import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateServiceDto } from '@application/services/dto/create-service.dto';
import { UpdateServiceDto } from '@application/services/dto/update-service.dto';
import { CreateServiceUseCase } from '@application/services/use-cases/create-service.use-case';
import { ListServicesUseCase } from '@application/services/use-cases/list-services.use-case';
import { UpdateServiceUseCase } from '@application/services/use-cases/update-service.use-case';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { ServiceResponseDto } from './dto/service-response.dto';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(
    private readonly createService: CreateServiceUseCase,
    private readonly listServices: ListServicesUseCase,
    private readonly updateService: UpdateServiceUseCase,
  ) {}

  @Get()
  @Auth(Permission.SERVICES_READ)
  @ApiOperation({ summary: 'Lists the service catalog' })
  @ApiResponse({ status: 200, type: [ServiceResponseDto] })
  async list(): Promise<ServiceResponseDto[]> {
    return (await this.listServices.execute()).map(ServiceResponseDto.from);
  }

  @Post()
  @Auth(Permission.SERVICES_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Creates a service' })
  @ApiResponse({ status: 201, type: ServiceResponseDto })
  async create(@Body() dto: CreateServiceDto): Promise<ServiceResponseDto> {
    return ServiceResponseDto.from(await this.createService.execute(dto));
  }

  @Patch(':id')
  @Auth(Permission.SERVICES_WRITE)
  @ApiOperation({ summary: 'Updates or deactivates a service' })
  @ApiResponse({ status: 200, type: ServiceResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ): Promise<ServiceResponseDto> {
    return ServiceResponseDto.from(await this.updateService.execute(id, dto));
  }
}
