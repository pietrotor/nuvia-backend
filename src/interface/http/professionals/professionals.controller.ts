import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ListEntityAppointmentsQueryDto } from '@application/appointments/dto/list-entity-appointments-query.dto';
import { ListProfessionalAppointmentsUseCase } from '@application/appointments/use-cases/list-professional-appointments.use-case';
import { CreateProfessionalDto } from '@application/professionals/dto/create-professional.dto';
import { UpdateProfessionalDto } from '@application/professionals/dto/update-professional.dto';
import { CreateProfessionalUseCase } from '@application/professionals/use-cases/create-professional.use-case';
import { DeleteProfessionalAvatarUseCase } from '@application/professionals/use-cases/delete-professional-avatar.use-case';
import { GetProfessionalAvatarUseCase } from '@application/professionals/use-cases/get-professional-avatar.use-case';
import { GetProfessionalUseCase } from '@application/professionals/use-cases/get-professional.use-case';
import { ListProfessionalsUseCase } from '@application/professionals/use-cases/list-professionals.use-case';
import { UpdateProfessionalUseCase } from '@application/professionals/use-cases/update-professional.use-case';
import { UploadProfessionalAvatarUseCase } from '@application/professionals/use-cases/upload-professional-avatar.use-case';
import { InvalidProfessionalAvatarFileError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_AVATAR_MAX_SIZE_BYTES,
  PROFESSIONAL_AVATAR_MAX_SIZE_MB,
} from '@domain/professionals/services/professional-avatar-image-validator';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { AppointmentViewResponseDto } from '@interface/http/appointments/dto/appointment-view-response.dto';
import { ProfessionalResponseDto } from './dto/professional-response.dto';

@ApiTags('Professionals')
@ApiBearerAuth()
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly createProfessional: CreateProfessionalUseCase,
    private readonly getProfessional: GetProfessionalUseCase,
    private readonly listProfessionals: ListProfessionalsUseCase,
    private readonly listProfessionalAppointments: ListProfessionalAppointmentsUseCase,
    private readonly updateProfessional: UpdateProfessionalUseCase,
    private readonly uploadProfessionalAvatar: UploadProfessionalAvatarUseCase,
    private readonly getProfessionalAvatar: GetProfessionalAvatarUseCase,
    private readonly deleteProfessionalAvatar: DeleteProfessionalAvatarUseCase,
  ) {}

  @Get()
  @Auth(Permission.PROFESSIONALS_READ)
  @ApiOperation({ summary: 'Lists the professionals of the business' })
  @ApiResponse({ status: 200, type: [ProfessionalResponseDto] })
  async list(): Promise<ProfessionalResponseDto[]> {
    return (await this.listProfessionals.execute()).map(
      ProfessionalResponseDto.from,
    );
  }

  @Get(':id/appointments')
  @Auth(Permission.PROFESSIONALS_READ)
  @ApiOperation({
    summary: 'Lists the appointments of a professional',
    description:
      'Full history by default. Pass onlyUpcoming=true for pending and confirmed from now on.',
  })
  @ApiResponse({ status: 200, type: [AppointmentViewResponseDto] })
  async listAppointments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListEntityAppointmentsQueryDto,
  ): Promise<AppointmentViewResponseDto[]> {
    const views = await this.listProfessionalAppointments.execute({
      professionalId: id,
      onlyUpcoming: query.onlyUpcoming,
    });
    return views.map(AppointmentViewResponseDto.from);
  }

  @Get(':id')
  @Auth(Permission.PROFESSIONALS_READ)
  @ApiOperation({ summary: 'Gets a professional by id' })
  @ApiResponse({ status: 200, type: ProfessionalResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProfessionalResponseDto> {
    return ProfessionalResponseDto.from(await this.getProfessional.execute(id));
  }

  @Post()
  @Auth(Permission.PROFESSIONALS_WRITE)
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
  @Auth(Permission.PROFESSIONALS_WRITE)
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

  @Post(':id/avatar')
  @Auth(Permission.PROFESSIONALS_WRITE)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PROFESSIONAL_AVATAR_MAX_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploads or replaces the professional avatar' })
  @ApiResponse({ status: 200, type: ProfessionalResponseDto })
  async uploadAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ProfessionalResponseDto> {
    if (!file) {
      throw new InvalidProfessionalAvatarFileError(
        PROFESSIONAL_AVATAR_MAX_SIZE_MB,
      );
    }

    return ProfessionalResponseDto.from(
      await this.uploadProfessionalAvatar.execute(id, {
        body: file.buffer,
        mimeType: file.mimetype,
      }),
    );
  }

  @Get(':id/avatar')
  @Auth(Permission.PROFESSIONALS_READ)
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @ApiOperation({ summary: 'Downloads the professional avatar image' })
  async avatar(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const image = await this.getProfessionalAvatar.execute(id);

    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Content-Length', image.body.length);
    /* The panel asks for this path with the version of the photo on it, so the bytes at a
     * given URL never change and the browser can keep them. Private: it is one tenant's
     * staff behind a Bearer token, not something a proxy may hold. */
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    response.send(image.body);
  }

  @Delete(':id/avatar')
  @Auth(Permission.PROFESSIONALS_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Removes the professional avatar' })
  @ApiResponse({ status: 200, type: ProfessionalResponseDto })
  async deleteAvatar(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProfessionalResponseDto> {
    return ProfessionalResponseDto.from(
      await this.deleteProfessionalAvatar.execute(id),
    );
  }
}
