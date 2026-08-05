import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ScheduleBlockView } from '@domain/schedule-blocks/repositories/schedule-block-view.repository';
import { ProfessionalSummaryResponseDto } from '@interface/http/common/dto/professional-summary-response.dto';

export class ScheduleBlockViewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  startsAt: string;

  @ApiProperty()
  endsAt: string;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({
    type: ProfessionalSummaryResponseDto,
    nullable: true,
    description: 'Null when the block applies to the whole business',
  })
  professional: ProfessionalSummaryResponseDto | null;

  static from(view: ScheduleBlockView): ScheduleBlockViewResponseDto {
    return {
      id: view.block.id,
      startsAt: view.block.startsAt.toISOString(),
      endsAt: view.block.endsAt.toISOString(),
      reason: view.block.reason,
      isActive: view.block.isActive,
      professional: view.professional
        ? ProfessionalSummaryResponseDto.from(view.professional)
        : null,
    };
  }
}
