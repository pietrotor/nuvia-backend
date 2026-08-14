import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  BackfillBranchesResult,
  BackfillBranchesUseCase,
} from '@application/branches/use-cases/backfill-branches.use-case';
import { Permission } from '@domain/users/value-objects/permission.vo';
import { Auth } from '../common/decorators';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly backfillBranches: BackfillBranchesUseCase) {}

  @Post('backfill-branches')
  @Auth(Permission.BACKFILL_RUN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Creates a primary branch per tenant and links orphaned rows (support only)',
  })
  execute(): Promise<BackfillBranchesResult> {
    return this.backfillBranches.execute();
  }
}
