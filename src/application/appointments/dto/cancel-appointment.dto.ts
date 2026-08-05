import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelAppointmentDto {
  @ApiPropertyOptional({ example: 'La clienta avisó que no puede llegar' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
