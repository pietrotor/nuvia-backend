import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// E.164: a leading plus, a country code that cannot start with zero, up to 15 digits.
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export class CreateClientDto {
  @ApiProperty({ example: 'María López' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: '+59171234567' })
  @Matches(E164_PATTERN, {
    message: 'phoneE164 must be a valid E.164 phone number',
  })
  phoneE164: string;

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
