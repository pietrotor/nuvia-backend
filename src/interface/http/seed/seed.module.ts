import { Module } from '@nestjs/common';

import { SeedUseCase } from '@application/seed/use-cases/seed.use-case';
import { SeedController } from './seed.controller';

@Module({
  controllers: [SeedController],
  providers: [SeedUseCase],
})
export class SeedModule {}
