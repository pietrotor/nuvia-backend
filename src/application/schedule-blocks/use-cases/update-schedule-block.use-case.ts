import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { ErrorCode, ValidationError } from '@domain/common/exceptions';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import { ScheduleBlock } from '@domain/schedule-blocks/entities/schedule-block.entity';
import { ScheduleBlockNotFoundError } from '@domain/schedule-blocks/exceptions/schedule-block.exceptions';
import {
  SCHEDULE_BLOCK_REPOSITORY,
  ScheduleBlockRepository,
  UpdateScheduleBlockData,
} from '@domain/schedule-blocks/repositories/schedule-block.repository';
import { UpdateScheduleBlockDto } from '../dto/update-schedule-block.dto';

@Injectable()
export class UpdateScheduleBlockUseCase {
  constructor(
    @Inject(SCHEDULE_BLOCK_REPOSITORY)
    private readonly scheduleBlockRepository: ScheduleBlockRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(
    id: string,
    dto: UpdateScheduleBlockDto,
  ): Promise<ScheduleBlock> {
    const current = await this.scheduleBlockRepository.findById(id);
    if (!current) throw new ScheduleBlockNotFoundError(id);

    if (dto.professionalId) {
      const professional = await this.professionalRepository.findById(
        dto.professionalId,
      );
      if (!professional) {
        throw new ProfessionalNotFoundError(dto.professionalId);
      }
    }

    const data: UpdateScheduleBlockData = {
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      reason: dto.reason?.trim() ?? dto.reason,
    };
    const startsAt = data.startsAt ?? current.startsAt;
    const endsAt = data.endsAt ?? current.endsAt;
    if (endsAt <= startsAt) {
      throw new ValidationError(ErrorCode.INVALID_TIME_RANGE);
    }

    const updated = await this.scheduleBlockRepository.update(id, data);
    if (!updated) throw new ScheduleBlockNotFoundError(id);

    await this.audit.record({
      action: AuditAction.SCHEDULE_BLOCK_UPDATED,
      entity: 'schedule_block',
      entityId: id,
      before: current,
      after: data,
    });

    return updated;
  }
}
