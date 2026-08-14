import { PartialType } from '@nestjs/swagger';

import { AssignProfessionalToBranchDto } from './assign-professional-to-branch.dto';

export class UpdateBranchProfessionalDto extends PartialType(
  AssignProfessionalToBranchDto,
) {}
