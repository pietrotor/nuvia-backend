import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { assertValidWeeklyHours } from '@domain/business-config/services/e1-config-validator';
import { Professional } from '@domain/professionals/entities/professional.entity';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import { UpdateProfessionalDto } from '../dto/update-professional.dto';

@Injectable()
export class UpdateProfessionalUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string, dto: UpdateProfessionalDto): Promise<Professional> {
    const current = await this.professionalRepository.findById(id);
    if (!current) throw new ProfessionalNotFoundError(id);

    if (dto.weeklyHours) {
      assertValidWeeklyHours(dto.weeklyHours);
    }

    const data = { ...dto, name: dto.name?.trim() };
    const updated = await this.professionalRepository.update(id, data);
    if (!updated) throw new ProfessionalNotFoundError(id);

    await this.audit.record({
      action: AuditAction.PROFESSIONAL_UPDATED,
      entity: 'professional',
      entityId: id,
      before: current,
      after: data,
    });

    return updated;
  }
}
