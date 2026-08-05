import { Inject, Injectable } from '@nestjs/common';

import { Professional } from '@domain/professionals/entities/professional.entity';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';

@Injectable()
export class ListProfessionalsUseCase {
  constructor(
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
  ) {}

  async execute(): Promise<Professional[]> {
    return this.professionalRepository.findAll();
  }
}
