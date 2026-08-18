import { ApiProperty } from '@nestjs/swagger';

import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';
import { BranchProfessionalServiceWindow } from '@domain/branches/entities/branch-professional-service-window.entity';

export class BranchProfessionalServiceWindowResponseDto {
  @ApiProperty()
  branchId: string;

  @ApiProperty()
  professionalId: string;

  @ApiProperty()
  serviceId: string;

  @ApiProperty({ type: Object })
  weeklyHours: WeeklyHours;

  @ApiProperty()
  isActive: boolean;

  static from(
    window: BranchProfessionalServiceWindow,
  ): BranchProfessionalServiceWindowResponseDto {
    return {
      branchId: window.branchId,
      professionalId: window.professionalId,
      serviceId: window.serviceId,
      weeklyHours: window.weeklyHours,
      isActive: window.isActive,
    };
  }
}
