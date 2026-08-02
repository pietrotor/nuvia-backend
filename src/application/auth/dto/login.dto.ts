import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ana@academiadanza.bo' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Secreta123' })
  @IsString()
  @MinLength(8)
  password: string;
}
