import { Inject, Injectable } from '@nestjs/common';

import { ErrorCode, ValidationError } from '@domain/common/exceptions';
import {
  SCHEDULE_BLOCK_VIEW_REPOSITORY,
  ScheduleBlockView,
  ScheduleBlockViewRepository,
} from '@domain/schedule-blocks/repositories/schedule-block-view.repository';
import { ListScheduleBlocksDto } from '../dto/list-schedule-blocks.dto';

@Injectable()
export class ListScheduleBlocksUseCase {
  constructor(
    @Inject(SCHEDULE_BLOCK_VIEW_REPOSITORY)
    private readonly scheduleBlockViewRepository: ScheduleBlockViewRepository,
  ) {}

  async execute(dto: ListScheduleBlocksDto): Promise<ScheduleBlockView[]> {
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (to <= from) {
      throw new ValidationError(ErrorCode.INVALID_TIME_RANGE);
    }

    return this.scheduleBlockViewRepository.findInRange({
      from,
      to,
      professionalId: dto.professionalId,
    });
  }
}
