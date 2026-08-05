import { ApiProperty } from '@nestjs/swagger';

import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';
import { Professional } from '@domain/professionals/entities/professional.entity';

export class ProfessionalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: Object })
  weeklyHours: WeeklyHours;

  @ApiProperty()
  isActive: boolean;

  static from(professional: Professional): ProfessionalResponseDto {
    return {
      id: professional.id,
      name: professional.name,
      weeklyHours: professional.weeklyHours,
      isActive: professional.isActive,
    };
  }
}
