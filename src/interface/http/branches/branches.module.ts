import { Module } from '@nestjs/common';

import { AssignProfessionalToBranchUseCase } from '@application/branches/use-cases/assign-professional-to-branch.use-case';
import { CreateBranchUseCase } from '@application/branches/use-cases/create-branch.use-case';
import { GetBranchUseCase } from '@application/branches/use-cases/get-branch.use-case';
import { ListBranchProfessionalsUseCase } from '@application/branches/use-cases/list-branch-professionals.use-case';
import { ListBranchProfessionalServiceWindowsUseCase } from '@application/branches/use-cases/list-branch-professional-service-windows.use-case';
import { ListBranchServicesUseCase } from '@application/branches/use-cases/list-branch-services.use-case';
import { ListBranchesUseCase } from '@application/branches/use-cases/list-branches.use-case';
import { OfferServiceAtBranchUseCase } from '@application/branches/use-cases/offer-service-at-branch.use-case';
import { RemoveBranchProfessionalServiceWindowUseCase } from '@application/branches/use-cases/remove-branch-professional-service-window.use-case';
import { UpdateBranchProfessionalUseCase } from '@application/branches/use-cases/update-branch-professional.use-case';
import { UpdateBranchServiceUseCase } from '@application/branches/use-cases/update-branch-service.use-case';
import { UpdateBranchUseCase } from '@application/branches/use-cases/update-branch.use-case';
import { UpsertBranchProfessionalServiceWindowUseCase } from '@application/branches/use-cases/upsert-branch-professional-service-window.use-case';
import { DepositQrAssignmentValidator } from '@application/services/services/deposit-qr-assignment-validator.service';

import { BranchesController } from './branches.controller';

@Module({
  controllers: [BranchesController],
  providers: [
    CreateBranchUseCase,
    ListBranchesUseCase,
    GetBranchUseCase,
    UpdateBranchUseCase,
    ListBranchProfessionalsUseCase,
    AssignProfessionalToBranchUseCase,
    UpdateBranchProfessionalUseCase,
    ListBranchServicesUseCase,
    OfferServiceAtBranchUseCase,
    UpdateBranchServiceUseCase,
    ListBranchProfessionalServiceWindowsUseCase,
    UpsertBranchProfessionalServiceWindowUseCase,
    RemoveBranchProfessionalServiceWindowUseCase,
    DepositQrAssignmentValidator,
  ],
  exports: [
    ListBranchesUseCase,
    GetBranchUseCase,
    CreateBranchUseCase,
    ListBranchServicesUseCase,
    ListBranchProfessionalsUseCase,
  ],
})
export class BranchesModule {}
