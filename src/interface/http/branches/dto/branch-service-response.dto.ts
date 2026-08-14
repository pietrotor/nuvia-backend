import { ApiProperty } from '@nestjs/swagger';

import { BranchService } from '@domain/branches/entities/branch-service.entity';

export class BranchServiceResponseDto {
  @ApiProperty()
  branchId: string;

  @ApiProperty()
  serviceId: string;

  @ApiProperty({
    nullable: true,
    description: 'Null keeps the catalog price',
  })
  priceOverride: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Null keeps the catalog deposit amount',
  })
  depositAmountOverride: string | null;

  @ApiProperty({ nullable: true })
  depositQrId: string | null;

  @ApiProperty()
  isActive: boolean;

  static from(offer: BranchService): BranchServiceResponseDto {
    return {
      branchId: offer.branchId,
      serviceId: offer.serviceId,
      priceOverride: offer.priceOverrideAmount,
      depositAmountOverride: offer.depositAmountOverrideAmount,
      depositQrId: offer.depositQrId,
      isActive: offer.isActive,
    };
  }
}
