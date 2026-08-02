import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  SeedResult,
  SeedUseCase,
} from '@application/seed/use-cases/seed.use-case';

// Unauthenticated on purpose: it has to be usable on an empty database. The use
// case refuses to run when NODE_ENV is production.
@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly seed: SeedUseCase) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recrea los datos de prueba (solo fuera de producción)',
  })
  execute(): Promise<SeedResult> {
    return this.seed.execute();
  }
}
