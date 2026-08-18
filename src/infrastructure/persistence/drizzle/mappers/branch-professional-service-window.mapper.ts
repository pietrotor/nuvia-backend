import { BranchProfessionalServiceWindow } from '@domain/branches/entities/branch-professional-service-window.entity';

import { BranchProfessionalServiceWindowSchema } from '../schema/branch-assignment.schema';

export class BranchProfessionalServiceWindowMapper {
  static toDomain(
    row: BranchProfessionalServiceWindowSchema,
  ): BranchProfessionalServiceWindow {
    return new BranchProfessionalServiceWindow({
      tenantId: row.tenantId,
      branchId: row.branchId,
      professionalId: row.professionalId,
      serviceId: row.serviceId,
      weeklyHours: row.weeklyHours,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
