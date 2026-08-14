import { ApiProperty } from '@nestjs/swagger';

import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';
import { Branch } from '@domain/branches/entities/branch.entity';

export class BranchResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ nullable: true })
  address: string | null;

  @ApiProperty({ nullable: true })
  mapsUrl: string | null;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ type: Object })
  weeklyHours: WeeklyHours;

  @ApiProperty({
    nullable: true,
    description: 'Null inherits the tenant timezone',
  })
  timezone: string | null;

  @ApiProperty()
  isPrimary: boolean;

  @ApiProperty()
  isActive: boolean;

  static from(branch: Branch): BranchResponseDto {
    return {
      id: branch.id,
      name: branch.name,
      slug: branch.slug,
      address: branch.address,
      mapsUrl: branch.mapsUrl,
      phone: branch.phone,
      weeklyHours: branch.weeklyHours,
      timezone: branch.timezone,
      isPrimary: branch.isPrimary,
      isActive: branch.isActive,
    };
  }
}
