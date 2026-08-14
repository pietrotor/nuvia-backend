import { NestFactory } from '@nestjs/core';

import { BackfillBranchesUseCase } from '@application/branches/use-cases/backfill-branches.use-case';
import { AppModule } from '../src/app.module';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const result = await app.get(BackfillBranchesUseCase).execute();

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
