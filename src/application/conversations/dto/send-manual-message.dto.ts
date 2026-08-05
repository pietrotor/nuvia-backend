import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendManualMessageDto {
  @ApiProperty({ example: 'Hola, te escribe Ana del centro.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text: string;
}
