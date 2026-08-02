import { join } from 'path';

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';

import { LoggerModule } from '@infrastructure/logger/logger.module';
import { I18nModule } from '@infrastructure/i18n/i18n.module';
import { TenancyModule } from '@infrastructure/tenancy/tenancy.module';
import { TenantContextMiddleware } from '@infrastructure/tenancy/tenant-context.middleware';
import { DrizzleModule } from '@infrastructure/persistence/drizzle/drizzle.module';
import { PersistenceModule } from '@infrastructure/persistence/persistence.module';
import { AuthInfrastructureModule } from '@infrastructure/auth/auth-infrastructure.module';
import { AuditModule } from '@application/audit/audit.module';
import { DomainExceptionFilter } from '@interface/http/common/filters/domain-exception.filter';
import { AuthModule } from '@interface/http/auth/auth.module';
import { UsersModule } from '@interface/http/users/users.module';
import { TenantsModule } from '@interface/http/tenants/tenants.module';
import { SeedModule } from '@interface/http/seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),

    LoggerModule,
    I18nModule,
    TenancyModule,
    DrizzleModule,
    PersistenceModule,
    AuthInfrastructureModule,

    AuditModule,

    AuthModule,
    UsersModule,
    TenantsModule,
    SeedModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('{*path}');
  }
}
