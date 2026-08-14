import { Global, Module } from '@nestjs/common';

import { EVENT_BUS_PORT } from '@domain/realtime/ports/event-bus.port';
import { AgendaEventPublisher } from '@application/realtime/services/agenda-event.publisher';
import { RedisModule } from '@infrastructure/redis/redis.module';
import { RedisEventBusAdapter } from './redis-event-bus.adapter';
import { SseConnectionRegistry } from './sse-connection.registry';

// Global like `AuditModule`: any use case may announce a change without importing anything.
@Global()
@Module({
  imports: [RedisModule],
  providers: [
    { provide: EVENT_BUS_PORT, useClass: RedisEventBusAdapter },
    SseConnectionRegistry,
    AgendaEventPublisher,
  ],
  exports: [EVENT_BUS_PORT, SseConnectionRegistry, AgendaEventPublisher],
})
export class RealtimeModule {}
