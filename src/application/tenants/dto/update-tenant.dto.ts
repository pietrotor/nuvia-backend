import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
} from 'class-validator';

export class UpdateTenantDto {
  @ApiProperty({ example: 'Academia de Danza Ritmo', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({ example: 'America/La_Paz', required: false })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({ example: '+59171234567', required: false })
  @IsOptional()
  @Matches(/^\+?[0-9]{8,15}$/)
  whatsappPhone?: string;

  @ApiProperty({
    example: 'https://cdn.cobrai.bo/qr/ritmo.png',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  staticQrUrl?: string;
}
