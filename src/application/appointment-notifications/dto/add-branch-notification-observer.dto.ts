import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddBranchNotificationObserverDto {
  @ApiProperty({ example: 'Recepcion Cochabamba' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  displayName: string;

  @ApiProperty({ example: '71234567' })
  @IsString()
  @MaxLength(20)
  phoneE164: string;
}
