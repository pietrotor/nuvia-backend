import { PartialType } from '@nestjs/swagger';

import { OfferServiceAtBranchDto } from './offer-service-at-branch.dto';

export class UpdateBranchServiceDto extends PartialType(
  OfferServiceAtBranchDto,
) {}
