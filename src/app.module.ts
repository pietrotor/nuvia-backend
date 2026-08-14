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
import { PortsModule } from '@infrastructure/ports/ports.module';
import { QueuesModule } from '@infrastructure/queues/queues.module';
import { RealtimeModule } from '@infrastructure/realtime/realtime.module';
import { AuditModule } from '@application/audit/audit.module';
import { BranchesModule as BranchesCoreModule } from '@application/branches/branches.module';
import { SubscriptionsModule } from '@application/subscriptions/subscriptions.module';
import { DomainExceptionFilter } from '@interface/http/common/filters/domain-exception.filter';
import { AdminModule } from '@interface/http/admin/admin.module';
import { AuthModule } from '@interface/http/auth/auth.module';
import { UsersModule } from '@interface/http/users/users.module';
import { TenantsModule } from '@interface/http/tenants/tenants.module';
import { SeedModule } from '@interface/http/seed/seed.module';
import { WebhooksModule } from '@interface/http/webhooks/webhooks.module';
import { AppointmentsModule } from '@interface/http/appointments/appointments.module';
import { BusinessConfigModule } from '@interface/http/business-config/business-config.module';
import { ClientsModule } from '@interface/http/clients/clients.module';
import { ConversationsModule } from '@interface/http/conversations/conversations.module';
import { DepositsModule } from '@interface/http/deposits/deposits.module';
import { ProfessionalsModule } from '@interface/http/professionals/professionals.module';
import { ServicesModule } from '@interface/http/services/services.module';
import { ScheduleBlocksModule } from '@interface/http/schedule-blocks/schedule-blocks.module';
import { MessagingModule } from '@interface/http/messaging/messaging.module';
import { EventsModule } from '@interface/http/events/events.module';
import { BranchesModule } from '@interface/http/branches/branches.module';
import { SubscriptionsHttpModule } from '@interface/http/subscriptions/subscriptions.module';

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
    QueuesModule,
    PortsModule,
    RealtimeModule,

    AuditModule,
    BranchesCoreModule,
    SubscriptionsModule,

    AuthModule,
    UsersModule,
    TenantsModule,
    AdminModule,
    SeedModule,
    WebhooksModule,
    AppointmentsModule,
    BusinessConfigModule,
    ClientsModule,
    ConversationsModule,
    DepositsModule,
    ProfessionalsModule,
    ServicesModule,
    BranchesModule,
    ScheduleBlocksModule,
    MessagingModule,
    EventsModule,
    SubscriptionsHttpModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('{*path}');
  }
}
