import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { assertValidDepositConfiguration } from '@domain/business-config/services/e1-config-validator';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import { Service } from '@domain/services/entities/service.entity';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
  UpdateServiceData,
} from '@domain/services/repositories/service.repository';
import { UpdateServiceDto } from '../dto/update-service.dto';
import { DepositQrAssignmentValidator } from '../services/deposit-qr-assignment-validator.service';

@Injectable()
export class UpdateServiceUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    private readonly depositQrAssignment: DepositQrAssignmentValidator,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(id: string, dto: UpdateServiceDto): Promise<Service> {
    const current = await this.serviceRepository.findById(id);
    if (!current) throw new ServiceNotFoundError(id);

    if (dto.professionalIds) {
      await this.assertProfessionalsExist(dto.professionalIds);
    }

    await this.depositQrAssignment.assertAssignable({
      depositQrId: dto.depositQrId,
      requiresDeposit: dto.requiresDeposit ?? current.requiresDeposit,
      branchId: null,
    });

    const data = this.normalize(dto);
    assertValidDepositConfiguration({
      requiresDeposit: data.requiresDeposit ?? current.requiresDeposit,
      depositAmount:
        data.depositAmount !== undefined
          ? data.depositAmount
          : (current.depositAmount?.amount ?? null),
      depositPercent:
        data.depositPercent !== undefined
          ? data.depositPercent
          : current.depositPercent,
    });

    const updated = await this.serviceRepository.update(id, data);
    if (!updated) throw new ServiceNotFoundError(id);

    await this.audit.record({
      action: AuditAction.SERVICE_UPDATED,
      entity: 'service',
      entityId: id,
      before: current,
      after: data,
    });

    return updated;
  }

  private normalize(dto: UpdateServiceDto): UpdateServiceData {
    const data: UpdateServiceData = { ...dto };
    // Only what the patch actually carries: an invented `name: undefined` turns a patch
    // that just moves the professionals into an update of no columns at all.
    if (dto.name !== undefined) data.name = dto.name.trim();

    if (dto.requiresDeposit === false) {
      data.depositAmount = null;
      data.depositPercent = null;
      // A service that stopped charging a deposit cannot keep pointing at a QR: the
      // database rejects that combination.
      data.depositQrId = null;
    } else if (dto.depositAmount) {
      data.depositPercent = null;
    } else if (dto.depositPercent) {
      data.depositAmount = null;
    }

    return data;
  }

  private async assertProfessionalsExist(ids: string[]): Promise<void> {
    const professionals = await Promise.all(
      ids.map((professionalId) =>
        this.professionalRepository.findById(professionalId),
      ),
    );
    const missingIndex = professionals.findIndex(
      (professional) => !professional,
    );
    if (missingIndex >= 0) {
      throw new ProfessionalNotFoundError(ids[missingIndex]);
    }
  }
}
