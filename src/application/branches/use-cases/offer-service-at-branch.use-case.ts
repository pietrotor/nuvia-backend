import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { DepositQrAssignmentValidator } from '@application/services/services/deposit-qr-assignment-validator.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { BranchService } from '@domain/branches/entities/branch-service.entity';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_SERVICE_REPOSITORY,
  BranchServiceRepository,
} from '@domain/branches/repositories/branch-service.repository';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';

import { OfferServiceAtBranchDto } from '../dto/offer-service-at-branch.dto';

@Injectable()
export class OfferServiceAtBranchUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    @Inject(BRANCH_SERVICE_REPOSITORY)
    private readonly branchServiceRepository: BranchServiceRepository,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    private readonly depositQrAssignment: DepositQrAssignmentValidator,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(
    branchId: string,
    serviceId: string,
    dto: OfferServiceAtBranchDto,
  ): Promise<BranchService> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    const service = await this.serviceRepository.findById(serviceId);
    if (!service) throw new ServiceNotFoundError(serviceId);

    await this.depositQrAssignment.assertAssignable({
      depositQrId: dto.depositQrId,
      requiresDeposit: service.requiresDeposit,
      branchId,
    });

    const offered = await this.branchServiceRepository.upsert({
      branchId,
      serviceId,
      priceOverrideAmount: dto.priceOverride ?? null,
      depositAmountOverrideAmount: dto.depositAmountOverride ?? null,
      depositQrId: dto.depositQrId ?? null,
      isActive: dto.isActive ?? true,
    });

    await this.audit.record({
      action: AuditAction.BRANCH_SERVICE_OFFERED,
      entity: 'branch_service',
      entityId: `${branchId}:${serviceId}`,
      after: dto,
    });

    return offered;
  }
}
