import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'María López' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: '71234567', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phoneE164?: string | null;

  @ApiPropertyOptional({ example: 'maria@example.com', nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @ApiPropertyOptional({ example: '1992-08-14', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string | null;

  @ApiPropertyOptional({ example: 'CI', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  identificationType?: string | null;

  @ApiPropertyOptional({ example: '1234567 CB', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  identificationNumber?: string | null;

  @ApiPropertyOptional({ example: 'Av. América 123', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ example: 'Prefers afternoon appointments' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
