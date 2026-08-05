import { Module } from '@nestjs/common';

import { CreateProfessionalUseCase } from '@application/professionals/use-cases/create-professional.use-case';
import { ListProfessionalsUseCase } from '@application/professionals/use-cases/list-professionals.use-case';
import { UpdateProfessionalUseCase } from '@application/professionals/use-cases/update-professional.use-case';
import { ProfessionalsController } from './professionals.controller';

@Module({
  controllers: [ProfessionalsController],
  providers: [
    CreateProfessionalUseCase,
    ListProfessionalsUseCase,
    UpdateProfessionalUseCase,
  ],
  exports: [ListProfessionalsUseCase],
})
export class ProfessionalsModule {}
