import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ListEntityAppointmentsQueryDto {
  @ApiPropertyOptional({
    description:
      'When true, only pending_deposit and confirmed appointments from now on.',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  onlyUpcoming?: boolean;
}
