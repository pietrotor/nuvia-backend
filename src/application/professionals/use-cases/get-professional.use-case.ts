import { Inject, Injectable } from '@nestjs/common';

import { Professional } from '@domain/professionals/entities/professional.entity';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';

@Injectable()
export class GetProfessionalUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
  ) {}

  async execute(id: string): Promise<Professional> {
    const professional = await this.professionalRepository.findById(id);
    if (!professional) throw new ProfessionalNotFoundError(id);
    return professional;
  }
}
