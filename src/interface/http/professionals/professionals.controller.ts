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

import { CreateProfessionalDto } from '@application/professionals/dto/create-professional.dto';
import { UpdateProfessionalDto } from '@application/professionals/dto/update-professional.dto';
import { CreateProfessionalUseCase } from '@application/professionals/use-cases/create-professional.use-case';
import { ListProfessionalsUseCase } from '@application/professionals/use-cases/list-professionals.use-case';
import { UpdateProfessionalUseCase } from '@application/professionals/use-cases/update-professional.use-case';
import { Role } from '@domain/users/value-objects/role.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { ProfessionalResponseDto } from './dto/professional-response.dto';

@ApiTags('Professionals')
@ApiBearerAuth()
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly createProfessional: CreateProfessionalUseCase,
    private readonly listProfessionals: ListProfessionalsUseCase,
    private readonly updateProfessional: UpdateProfessionalUseCase,
  ) {}

  @Get()
  @Auth(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Lists the professionals of the business' })
  @ApiResponse({ status: 200, type: [ProfessionalResponseDto] })
  async list(): Promise<ProfessionalResponseDto[]> {
    return (await this.listProfessionals.execute()).map(
      ProfessionalResponseDto.from,
    );
  }

  @Post()
  @Auth(Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Creates a professional' })
  @ApiResponse({ status: 201, type: ProfessionalResponseDto })
  async create(
    @Body() dto: CreateProfessionalDto,
  ): Promise<ProfessionalResponseDto> {
    return ProfessionalResponseDto.from(
      await this.createProfessional.execute(dto),
    );
  }

  @Patch(':id')
  @Auth(Role.OWNER)
  @ApiOperation({ summary: 'Updates or deactivates a professional' })
  @ApiResponse({ status: 200, type: ProfessionalResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfessionalDto,
  ): Promise<ProfessionalResponseDto> {
    return ProfessionalResponseDto.from(
      await this.updateProfessional.execute(id, dto),
    );
  }
}
