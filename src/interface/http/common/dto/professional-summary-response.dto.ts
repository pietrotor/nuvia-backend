import { ApiProperty } from '@nestjs/swagger';

import { ProfessionalSummary } from '@domain/professionals/views/professional-summary';

export class ProfessionalSummaryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  static from(
    professional: ProfessionalSummary,
  ): ProfessionalSummaryResponseDto {
    return {
      id: professional.id,
      name: professional.name,
    };
  }
}
