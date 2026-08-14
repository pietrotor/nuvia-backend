import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';

import { BranchProfessionalSchema } from '../schema/branch-assignment.schema';

export class BranchProfessionalMapper {
  static toDomain(row: BranchProfessionalSchema): BranchProfessional {
    return new BranchProfessional({
      tenantId: row.tenantId,
      branchId: row.branchId,
      professionalId: row.professionalId,
      weeklyHours: row.weeklyHours,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
