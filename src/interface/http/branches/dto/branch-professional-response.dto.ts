import { ApiProperty } from '@nestjs/swagger';

import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';
import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';

export class BranchProfessionalResponseDto {
  @ApiProperty()
  branchId: string;

  @ApiProperty()
  professionalId: string;

  @ApiProperty({ type: Object })
  weeklyHours: WeeklyHours;

  @ApiProperty()
  isActive: boolean;

  static from(assignment: BranchProfessional): BranchProfessionalResponseDto {
    return {
      branchId: assignment.branchId,
      professionalId: assignment.professionalId,
      weeklyHours: assignment.weeklyHours,
      isActive: assignment.isActive,
    };
  }
}
