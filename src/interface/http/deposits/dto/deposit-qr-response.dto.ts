import { ApiProperty } from '@nestjs/swagger';

import { DepositQr } from '@domain/deposits/entities/deposit-qr.entity';

export class DepositQrResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    nullable: true,
    description: 'Branch scope; null means this QR is tenant-wide',
  })
  branchId: string | null;

  @ApiProperty()
  label: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty({
    description:
      'Used by default within this QR scope when no service override applies',
  })
  isDefault: boolean;

  @ApiProperty()
  isActive: boolean;

  // The storage key never leaves the API: it says which provider and layout we use,
  // and the client downloads the image from GET /deposit-qrs/{id}/image instead.
  static from(depositQr: DepositQr): DepositQrResponseDto {
    return {
      id: depositQr.id,
      branchId: depositQr.branchId,
      label: depositQr.label,
      mimeType: depositQr.mimeType,
      sizeBytes: depositQr.sizeBytes,
      isDefault: depositQr.isDefault,
      isActive: depositQr.isActive,
    };
  }
}
