import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @ApiProperty({ example: 'Estética Glow', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ example: 'America/La_Paz', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ example: 'trial', required: false })
  @IsOptional()
  @IsString()
  plan?: string;
}
