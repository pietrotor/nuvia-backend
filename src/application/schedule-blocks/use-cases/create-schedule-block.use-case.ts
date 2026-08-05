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
import {
  SCHEDULE_BLOCK_REPOSITORY,
  ScheduleBlockRepository,
} from '@domain/schedule-blocks/repositories/schedule-block.repository';
import { CreateScheduleBlockDto } from '../dto/create-schedule-block.dto';

@Injectable()
export class CreateScheduleBlockUseCase {
  constructor(
    @Inject(SCHEDULE_BLOCK_REPOSITORY)
    private readonly scheduleBlockRepository: ScheduleBlockRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(dto: CreateScheduleBlockDto): Promise<ScheduleBlock> {
    if (dto.professionalId) {
      const professional = await this.professionalRepository.findById(
        dto.professionalId,
      );
      if (!professional) {
        throw new ProfessionalNotFoundError(dto.professionalId);
      }
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new ValidationError(ErrorCode.INVALID_TIME_RANGE);
    }

    const created = await this.scheduleBlockRepository.create({
      professionalId: dto.professionalId,
      startsAt,
      endsAt,
      reason: dto.reason?.trim() ?? dto.reason,
    });

    await this.audit.record({
      action: AuditAction.SCHEDULE_BLOCK_CREATED,
      entity: 'schedule_block',
      entityId: created.id,
      after: dto,
    });

    return created;
  }
}
