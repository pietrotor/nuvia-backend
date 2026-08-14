import { Module } from '@nestjs/common';

import { CreateProfessionalUseCase } from '@application/professionals/use-cases/create-professional.use-case';
import { DeleteProfessionalAvatarUseCase } from '@application/professionals/use-cases/delete-professional-avatar.use-case';
import { GetProfessionalAvatarUseCase } from '@application/professionals/use-cases/get-professional-avatar.use-case';
import { GetProfessionalUseCase } from '@application/professionals/use-cases/get-professional.use-case';
import { ListProfessionalsUseCase } from '@application/professionals/use-cases/list-professionals.use-case';
import { UpdateProfessionalUseCase } from '@application/professionals/use-cases/update-professional.use-case';
import { UploadProfessionalAvatarUseCase } from '@application/professionals/use-cases/upload-professional-avatar.use-case';
import { AppointmentsModule } from '@interface/http/appointments/appointments.module';
import { ProfessionalsController } from './professionals.controller';

@Module({
  imports: [AppointmentsModule],
  controllers: [ProfessionalsController],
  providers: [
    CreateProfessionalUseCase,
    GetProfessionalUseCase,
    ListProfessionalsUseCase,
    UpdateProfessionalUseCase,
    UploadProfessionalAvatarUseCase,
    GetProfessionalAvatarUseCase,
    DeleteProfessionalAvatarUseCase,
  ],
  exports: [ListProfessionalsUseCase, GetProfessionalUseCase],
})
export class ProfessionalsModule {}
