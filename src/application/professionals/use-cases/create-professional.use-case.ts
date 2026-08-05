import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { assertValidWeeklyHours } from '@domain/business-config/services/e1-config-validator';
import { Professional } from '@domain/professionals/entities/professional.entity';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import { CreateProfessionalDto } from '../dto/create-professional.dto';

@Injectable()
export class CreateProfessionalUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(dto: CreateProfessionalDto): Promise<Professional> {
    assertValidWeeklyHours(dto.weeklyHours);
    const created = await this.professionalRepository.create({
      ...dto,
      name: dto.name.trim(),
    });

    await this.audit.record({
      action: AuditAction.PROFESSIONAL_CREATED,
      entity: 'professional',
      entityId: created.id,
      after: dto,
    });

    return created;
  }
}
