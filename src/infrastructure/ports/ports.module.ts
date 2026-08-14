import { Global, Module } from '@nestjs/common';

import { LLM_PORT } from '@domain/agent/ports/llm.port';
import { MESSAGING_PORT } from '@domain/messaging/ports/messaging.port';
import { WHATSAPP_SESSION_PORT } from '@domain/messaging/ports/whatsapp-session.port';
import { OBJECT_STORAGE_PORT } from '@domain/storage/ports/object-storage.port';
import { RUNTIME_ENVIRONMENT_PORT } from '@domain/common/ports/runtime-environment.port';
import { CLOCK_PORT } from '@domain/common/ports/clock.port';

import { OpenAiCompatibleLlmAdapter } from '../llm/openai-compatible-llm.adapter';
import { AnthropicLlmAdapter } from '../llm/anthropic-llm.adapter';
import { ConfiguredLlmAdapter } from '../llm/configured-llm.adapter';
import { LocalObjectStorageAdapter } from '../storage/local-object-storage.adapter';
import { S3ObjectStorageAdapter } from '../storage/s3-object-storage.adapter';
import { ConfiguredObjectStorageAdapter } from '../storage/configured-object-storage.adapter';
import { EvolutionMessagingAdapter } from '../messaging/evolution-messaging.adapter';
import { EvolutionSessionAdapter } from '../messaging/evolution-session.adapter';
import { RuntimeEnvironmentAdapter } from '../config/runtime-environment.adapter';
import { SystemClockAdapter } from '../time/system-clock.adapter';
import { EvolutionApiClient } from '../messaging/evolution-api.client';

@Global()
@Module({
  providers: [
    EvolutionApiClient,
    AnthropicLlmAdapter,
    OpenAiCompatibleLlmAdapter,
    ConfiguredLlmAdapter,
    LocalObjectStorageAdapter,
    S3ObjectStorageAdapter,
    ConfiguredObjectStorageAdapter,
    { provide: MESSAGING_PORT, useClass: EvolutionMessagingAdapter },
    { provide: WHATSAPP_SESSION_PORT, useClass: EvolutionSessionAdapter },
    { provide: LLM_PORT, useExisting: ConfiguredLlmAdapter },
    {
      provide: OBJECT_STORAGE_PORT,
      useExisting: ConfiguredObjectStorageAdapter,
    },
    {
      provide: RUNTIME_ENVIRONMENT_PORT,
      useClass: RuntimeEnvironmentAdapter,
    },
    { provide: CLOCK_PORT, useClass: SystemClockAdapter },
  ],
  exports: [
    MESSAGING_PORT,
    WHATSAPP_SESSION_PORT,
    LLM_PORT,
    OBJECT_STORAGE_PORT,
    RUNTIME_ENVIRONMENT_PORT,
    CLOCK_PORT,
  ],
})
export class PortsModule {}
