import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

// The image itself travels as multipart, not as a field of this DTO: the controller
// hands the bytes to the use case.
export class UploadDepositQrDto {
  @ApiProperty({
    example: 'BNB principal',
    description: 'How the owner recognizes the account this QR charges to',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label: string;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description:
      'Branch this QR belongs to; omit it for a tenant-wide fallback QR',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
