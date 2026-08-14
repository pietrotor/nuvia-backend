import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { DepositQrAssignmentValidator } from '@application/services/services/deposit-qr-assignment-validator.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { BranchService } from '@domain/branches/entities/branch-service.entity';
import {
  BranchNotFoundError,
  ServiceNotOfferedAtBranchError,
} from '@domain/branches/exceptions/branch.exceptions';
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

import { UpdateBranchServiceDto } from '../dto/update-branch-service.dto';

@Injectable()
export class UpdateBranchServiceUseCase {
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
    dto: UpdateBranchServiceDto,
  ): Promise<BranchService> {
    const branch = await this.branchRepository.findById(branchId);
    if (!branch) throw new BranchNotFoundError(branchId);

    const current = await this.branchServiceRepository.findByBranchAndService(
      branchId,
      serviceId,
    );
    if (!current) {
      throw new ServiceNotOfferedAtBranchError(serviceId, branchId);
    }

    if (dto.depositQrId !== undefined) {
      const service = await this.serviceRepository.findById(serviceId);
      if (!service) throw new ServiceNotFoundError(serviceId);

      await this.depositQrAssignment.assertAssignable({
        depositQrId: dto.depositQrId,
        requiresDeposit: service.requiresDeposit,
      });
    }

    const updated =
      dto.isActive === false
        ? await this.branchServiceRepository.deactivate(branchId, serviceId)
        : await this.branchServiceRepository.upsert({
            branchId,
            serviceId,
            priceOverrideAmount:
              dto.priceOverride !== undefined
                ? dto.priceOverride
                : current.priceOverrideAmount,
            depositAmountOverrideAmount:
              dto.depositAmountOverride !== undefined
                ? dto.depositAmountOverride
                : current.depositAmountOverrideAmount,
            depositQrId:
              dto.depositQrId !== undefined
                ? dto.depositQrId
                : current.depositQrId,
            isActive: dto.isActive ?? current.isActive,
          });

    if (!updated) {
      throw new ServiceNotOfferedAtBranchError(serviceId, branchId);
    }

    await this.audit.record({
      action: AuditAction.BRANCH_SERVICE_UPDATED,
      entity: 'branch_service',
      entityId: `${branchId}:${serviceId}`,
      before: current,
      after: dto,
    });

    return updated;
  }
}
