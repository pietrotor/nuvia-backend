import { NestFactory } from '@nestjs/core';

import { CreateTenantUseCase } from '@application/tenants/use-cases/create-tenant.use-case';
import { ListTenantsUseCase } from '@application/tenants/use-cases/list-tenants.use-case';

import { AppModule } from '../app.module';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const listTenants = app.get(ListTenantsUseCase);
    const existing = await listTenants.execute();
    if (existing.length > 0) {
      process.stderr.write(
        `Refusing to bootstrap: ${existing.length} business(es) already exist.\n`,
      );
      process.exitCode = 1;
      return;
    }

    const createTenant = app.get(CreateTenantUseCase);
    const result = await createTenant.execute({
      name: requiredEnv('BOOTSTRAP_TENANT_NAME'),
      countryCode: process.env.BOOTSTRAP_COUNTRY_CODE?.trim() || 'BO',
      timezone: process.env.BOOTSTRAP_TIMEZONE?.trim() || 'America/La_Paz',
      owner: {
        name: requiredEnv('BOOTSTRAP_OWNER_NAME'),
        email: requiredEnv('BOOTSTRAP_EMAIL'),
        password: requiredEnv('BOOTSTRAP_PASSWORD'),
        phone: process.env.BOOTSTRAP_PHONE?.trim() || undefined,
      },
    });

    process.stdout.write(
      `Created tenant ${result.tenant.id} and owner ${result.owner.email}\n`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Bootstrap failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
