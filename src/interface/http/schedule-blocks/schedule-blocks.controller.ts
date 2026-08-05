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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateScheduleBlockDto } from '@application/schedule-blocks/dto/create-schedule-block.dto';
import { ListScheduleBlocksDto } from '@application/schedule-blocks/dto/list-schedule-blocks.dto';
import { UpdateScheduleBlockDto } from '@application/schedule-blocks/dto/update-schedule-block.dto';
import { CreateScheduleBlockUseCase } from '@application/schedule-blocks/use-cases/create-schedule-block.use-case';
import { ListScheduleBlocksUseCase } from '@application/schedule-blocks/use-cases/list-schedule-blocks.use-case';
import { UpdateScheduleBlockUseCase } from '@application/schedule-blocks/use-cases/update-schedule-block.use-case';
import { Role } from '@domain/users/value-objects/role.vo';
import { Auth } from '@interface/http/common/decorators/auth.decorator';
import { ScheduleBlockResponseDto } from './dto/schedule-block-response.dto';
import { ScheduleBlockViewResponseDto } from './dto/schedule-block-view-response.dto';

@ApiTags('Schedule blocks')
@ApiBearerAuth()
@Controller('schedule-blocks')
export class ScheduleBlocksController {
  constructor(
    private readonly createScheduleBlock: CreateScheduleBlockUseCase,
    private readonly listScheduleBlocks: ListScheduleBlocksUseCase,
    private readonly updateScheduleBlock: UpdateScheduleBlockUseCase,
  ) {}

  @Get()
  @Auth(Role.OWNER, Role.STAFF)
  @ApiOperation({
    summary: 'Lists active schedule blocks, with the affected professional',
  })
  @ApiResponse({ status: 200, type: [ScheduleBlockViewResponseDto] })
  async list(
    @Query() query: ListScheduleBlocksDto,
  ): Promise<ScheduleBlockViewResponseDto[]> {
    return (await this.listScheduleBlocks.execute(query)).map(
      ScheduleBlockViewResponseDto.from,
    );
  }

  @Post()
  @Auth(Role.OWNER, Role.STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Blocks a time range in the schedule' })
  @ApiResponse({ status: 201, type: ScheduleBlockResponseDto })
  async create(
    @Body() dto: CreateScheduleBlockDto,
  ): Promise<ScheduleBlockResponseDto> {
    return ScheduleBlockResponseDto.from(
      await this.createScheduleBlock.execute(dto),
    );
  }

  @Patch(':id')
  @Auth(Role.OWNER, Role.STAFF)
  @ApiOperation({ summary: 'Updates or deactivates a schedule block' })
  @ApiResponse({ status: 200, type: ScheduleBlockResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleBlockDto,
  ): Promise<ScheduleBlockResponseDto> {
    return ScheduleBlockResponseDto.from(
      await this.updateScheduleBlock.execute(id, dto),
    );
  }
}
