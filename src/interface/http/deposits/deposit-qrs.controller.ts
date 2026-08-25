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
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';

import { ListDepositQrsDto } from '@application/deposits/dto/list-deposit-qrs.dto';
import { UpdateDepositQrDto } from '@application/deposits/dto/update-deposit-qr.dto';
import { UploadDepositQrDto } from '@application/deposits/dto/upload-deposit-qr.dto';
import { GetDepositQrImageUseCase } from '@application/deposits/use-cases/get-deposit-qr-image.use-case';
import { ListDepositQrsUseCase } from '@application/deposits/use-cases/list-deposit-qrs.use-case';
import { UpdateDepositQrUseCase } from '@application/deposits/use-cases/update-deposit-qr.use-case';
import { UploadDepositQrUseCase } from '@application/deposits/use-cases/upload-deposit-qr.use-case';
import { InvalidDepositQrFileError } from '@domain/deposits/exceptions/deposit-qr.exceptions';
import {
  DEPOSIT_QR_MAX_SIZE_BYTES,
  DEPOSIT_QR_MAX_SIZE_MB,
} from '@domain/deposits/services/deposit-qr-image-validator';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { DepositQrResponseDto } from './dto/deposit-qr-response.dto';

@ApiTags('Deposit QRs')
@ApiBearerAuth()
@Controller('deposit-qrs')
export class DepositQrsController {
  constructor(
    private readonly uploadDepositQr: UploadDepositQrUseCase,
    private readonly listDepositQrs: ListDepositQrsUseCase,
    private readonly updateDepositQr: UpdateDepositQrUseCase,
    private readonly getDepositQrImage: GetDepositQrImageUseCase,
  ) {}

  @Get()
  @Auth(Permission.DEPOSITS_READ)
  @ApiOperation({ summary: 'Lists the payment QRs of the business' })
  @ApiResponse({ status: 200, type: [DepositQrResponseDto] })
  async list(
    @Query() query: ListDepositQrsDto,
  ): Promise<DepositQrResponseDto[]> {
    return (await this.listDepositQrs.execute(query)).map(
      DepositQrResponseDto.from,
    );
  }

  @Post()
  @Auth(Permission.DEPOSITS_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DEPOSIT_QR_MAX_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['label', 'file'],
      properties: {
        label: { type: 'string', example: 'BNB principal' },
        branchId: {
          type: 'string',
          format: 'uuid',
          description:
            'Branch scope; omit it to create a tenant-wide fallback QR',
        },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Uploads a payment QR image' })
  @ApiResponse({ status: 201, type: DepositQrResponseDto })
  async upload(
    @Body() dto: UploadDepositQrDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<DepositQrResponseDto> {
    if (!file) throw new InvalidDepositQrFileError(DEPOSIT_QR_MAX_SIZE_MB);

    return DepositQrResponseDto.from(
      await this.uploadDepositQr.execute(dto, {
        body: file.buffer,
        mimeType: file.mimetype,
      }),
    );
  }

  @Patch(':id')
  @Auth(Permission.DEPOSITS_WRITE)
  @ApiOperation({ summary: 'Renames, archives or makes a payment QR default' })
  @ApiResponse({ status: 200, type: DepositQrResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepositQrDto,
  ): Promise<DepositQrResponseDto> {
    return DepositQrResponseDto.from(
      await this.updateDepositQr.execute(id, dto),
    );
  }

  // Streams the bytes instead of redirecting to a signed URL: the tenant is checked on
  // every download and the panel behaves the same whatever storage backend runs.
  @Get(':id/image')
  @Auth(Permission.DEPOSITS_READ)
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @ApiOperation({ summary: 'Downloads the image of a payment QR' })
  @ApiResponse({ status: 200, description: 'The QR image' })
  async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ): Promise<void> {
    const image = await this.getDepositQrImage.execute(id);

    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Content-Length', image.body.length);
    response.send(image.body);
  }
}
