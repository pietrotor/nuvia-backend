import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateDepositQrDto {
  @ApiProperty({ example: 'BNB principal', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label?: string;

  @ApiProperty({
    required: false,
    description: 'Makes this the QR used by every service without its own',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({
    required: false,
    description: 'False archives the QR: nothing is deleted',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
