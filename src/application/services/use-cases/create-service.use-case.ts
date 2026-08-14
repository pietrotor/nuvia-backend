import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { assertValidDepositConfiguration } from '@domain/business-config/services/e1-config-validator';
import { BusinessConfigNotFoundError } from '@domain/business-config/exceptions/business-config.exceptions';
import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import {
  PROFESSIONAL_REPOSITORY,
  ProfessionalRepository,
} from '@domain/professionals/repositories/professional.repository';
import { Service } from '@domain/services/entities/service.entity';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';
import { CreateServiceDto } from '../dto/create-service.dto';
import { DepositQrAssignmentValidator } from '../services/deposit-qr-assignment-validator.service';
import { PlanEntitlements } from '@application/subscriptions/services/plan-entitlements.service';
import { PlanCap } from '@domain/subscriptions/value-objects/plan-config.vo';

@Injectable()
export class CreateServiceUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(PROFESSIONAL_REPOSITORY)
    private readonly professionalRepository: ProfessionalRepository,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
    private readonly depositQrAssignment: DepositQrAssignmentValidator,
    private readonly audit: AuditRecorder,
    private readonly entitlements: PlanEntitlements,
  ) {}

  async execute(dto: CreateServiceDto): Promise<Service> {
    await this.entitlements.assertWithinCap(PlanCap.SERVICES);
    await this.assertProfessionalsExist(dto.professionalIds);

    const requiresDeposit = dto.requiresDeposit ?? false;
    const depositAmount = dto.depositAmount ?? null;
    const depositPercent = dto.depositPercent ?? null;
    const depositQrId = dto.depositQrId ?? null;
    assertValidDepositConfiguration({
      requiresDeposit,
      depositAmount,
      depositPercent,
    });
    await this.depositQrAssignment.assertAssignable({
      depositQrId,
      requiresDeposit,
    });

    const currency = dto.currency ?? (await this.businessCurrency());
    const created = await this.serviceRepository.create({
      ...dto,
      name: dto.name.trim(),
      currency,
      requiresDeposit,
      depositAmount,
      depositPercent,
      depositQrId,
    });

    await this.audit.record({
      action: AuditAction.SERVICE_CREATED,
      entity: 'service',
      entityId: created.id,
      after: { ...dto, currency },
    });

    return created;
  }

  private async businessCurrency(): Promise<Currency> {
    const config = await this.businessConfigRepository.findByTenant();
    if (!config) throw new BusinessConfigNotFoundError();

    return config.currency;
  }

  private async assertProfessionalsExist(ids: string[]): Promise<void> {
    const professionals = await Promise.all(
      ids.map((id) => this.professionalRepository.findById(id)),
    );
    const missingIndex = professionals.findIndex(
      (professional) => !professional,
    );
    if (missingIndex >= 0) {
      throw new ProfessionalNotFoundError(ids[missingIndex]);
    }
  }
}
