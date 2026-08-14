import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateBranchDto } from './create-branch.dto';

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @ApiPropertyOptional({ description: 'Deactivate without deleting the row' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
