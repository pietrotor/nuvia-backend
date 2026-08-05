import { Module } from '@nestjs/common';

import { CreateScheduleBlockUseCase } from '@application/schedule-blocks/use-cases/create-schedule-block.use-case';
import { ListScheduleBlocksUseCase } from '@application/schedule-blocks/use-cases/list-schedule-blocks.use-case';
import { UpdateScheduleBlockUseCase } from '@application/schedule-blocks/use-cases/update-schedule-block.use-case';
import { ScheduleBlocksController } from './schedule-blocks.controller';

@Module({
  controllers: [ScheduleBlocksController],
  providers: [
    CreateScheduleBlockUseCase,
    ListScheduleBlocksUseCase,
    UpdateScheduleBlockUseCase,
  ],
})
export class ScheduleBlocksModule {}
