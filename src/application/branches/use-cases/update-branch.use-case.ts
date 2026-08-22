import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
  UpdateBranchData,
} from '@domain/branches/repositories/branch.repository';
import { assertValidWeeklyHours } from '@domain/business-config/services/e1-config-validator';
import { PhoneNumberService } from '@application/common/services/phone-number.service';
import { TenantCountryService } from '@application/common/services/tenant-country.service';

import { UpdateBranchDto } from '../dto/update-branch.dto';
import { slugifyBranchName } from '../services/branch-slug';

@Injectable()
export class UpdateBranchUseCase {
  constructor(
    @Inject(BRANCH_REPOSITORY)
    private readonly branchRepository: BranchRepository,
    private readonly audit: AuditRecorder,
    private readonly phoneNumbers: PhoneNumberService,
    private readonly tenantCountry: TenantCountryService,
  ) {}

  async execute(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const current = await this.branchRepository.findById(id);
    if (!current) throw new BranchNotFoundError(id);

    if (dto.weeklyHours) {
      assertValidWeeklyHours(dto.weeklyHours);
    }

    if (dto.isPrimary === true && !current.isPrimary) {
      await this.demoteCurrentPrimary(id);
    }

    const country = await this.tenantCountry.getCurrentCountryCode();
    const data = this.normalize(dto, current.phone, country);
    const updated = await this.branchRepository.update(id, data);
    if (!updated) throw new BranchNotFoundError(id);

    await this.audit.record({
      action: AuditAction.BRANCH_UPDATED,
      entity: 'branch',
      entityId: id,
      before: current,
      after: data,
    });

    return updated;
  }

  private normalize(
    dto: UpdateBranchDto,
    currentPhone: string | null,
    country: string,
  ): UpdateBranchData {
    const data: UpdateBranchData = {
      ...dto,
      name: dto.name?.trim(),
      slug: dto.slug?.trim(),
      phone:
        dto.phone === undefined
          ? undefined
          : this.phoneNumbers.resolvePhoneForWrite(
              dto.phone,
              currentPhone,
              country,
            ),
    };

    if (dto.name !== undefined && dto.slug === undefined) {
      data.slug = slugifyBranchName(dto.name);
    }

    return data;
  }

  private async demoteCurrentPrimary(exceptId: string): Promise<void> {
    const current = await this.branchRepository.findPrimary();
    if (!current || current.id === exceptId) return;

    await this.branchRepository.update(current.id, { isPrimary: false });
  }
}
