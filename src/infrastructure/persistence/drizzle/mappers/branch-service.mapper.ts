import { BranchService } from '@domain/branches/entities/branch-service.entity';

import { BranchServiceSchema } from '../schema/branch-assignment.schema';

export class BranchServiceMapper {
  static toDomain(row: BranchServiceSchema): BranchService {
    return new BranchService({
      tenantId: row.tenantId,
      branchId: row.branchId,
      serviceId: row.serviceId,
      priceOverrideAmount: row.priceOverride,
      depositAmountOverrideAmount: row.depositAmountOverride,
      depositQrId: row.depositQrId,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
