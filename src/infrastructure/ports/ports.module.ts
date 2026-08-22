import { Global, Module } from '@nestjs/common';

import { LLM_PORT } from '@domain/agent/ports/llm.port';
import { CHAT_LABEL_PORT } from '@domain/messaging/ports/chat-label.port';
import { MESSAGING_PORT } from '@domain/messaging/ports/messaging.port';
import { OUTBOUND_SAFETY_PORT } from '@domain/messaging/ports/outbound-safety.port';
import { WHATSAPP_SESSION_PORT } from '@domain/messaging/ports/whatsapp-session.port';
import { OBJECT_STORAGE_PORT } from '@domain/storage/ports/object-storage.port';
import { RUNTIME_ENVIRONMENT_PORT } from '@domain/common/ports/runtime-environment.port';
import { CLOCK_PORT } from '@domain/common/ports/clock.port';
import { RECEIPT_IMAGE_CLASSIFIER_PORT } from '@domain/deposits/ports/receipt-image-classifier.port';

import { OpenAiCompatibleLlmAdapter } from '../llm/openai-compatible-llm.adapter';
import { OpenRouterLlmAdapter } from '../llm/openrouter-llm.adapter';
import { AnthropicLlmAdapter } from '../llm/anthropic-llm.adapter';
import { ConfiguredLlmAdapter } from '../llm/configured-llm.adapter';
import { LocalObjectStorageAdapter } from '../storage/local-object-storage.adapter';
import { S3ObjectStorageAdapter } from '../storage/s3-object-storage.adapter';
import { ConfiguredObjectStorageAdapter } from '../storage/configured-object-storage.adapter';
import { EvolutionMessagingAdapter } from '../messaging/evolution-messaging.adapter';
import { EvolutionChatLabelAdapter } from '../messaging/evolution-chat-label.adapter';
import { EvolutionSessionAdapter } from '../messaging/evolution-session.adapter';
import { RuntimeEnvironmentAdapter } from '../config/runtime-environment.adapter';
import { SystemClockAdapter } from '../time/system-clock.adapter';
import { EvolutionApiClient } from '../messaging/evolution-api.client';
import {
  EVOLUTION_MESSAGING_ADAPTER,
  GatedMessagingAdapter,
} from '../messaging/gated-messaging.adapter';
import { OutboundSafetyGate } from '../messaging/outbound-safety.gate';
import { RedisModule } from '../redis/redis.module';
import { TesseractReceiptImageClassifierAdapter } from '../ocr/tesseract-receipt-image-classifier.adapter';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    EvolutionApiClient,
    AnthropicLlmAdapter,
    OpenAiCompatibleLlmAdapter,
    OpenRouterLlmAdapter,
    ConfiguredLlmAdapter,
    LocalObjectStorageAdapter,
    S3ObjectStorageAdapter,
    ConfiguredObjectStorageAdapter,
    EvolutionMessagingAdapter,
    OutboundSafetyGate,
    {
      provide: EVOLUTION_MESSAGING_ADAPTER,
      useExisting: EvolutionMessagingAdapter,
    },
    { provide: OUTBOUND_SAFETY_PORT, useExisting: OutboundSafetyGate },
    { provide: MESSAGING_PORT, useClass: GatedMessagingAdapter },
    { provide: CHAT_LABEL_PORT, useClass: EvolutionChatLabelAdapter },
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
    {
      provide: RECEIPT_IMAGE_CLASSIFIER_PORT,
      useClass: TesseractReceiptImageClassifierAdapter,
    },
  ],
  exports: [
    MESSAGING_PORT,
    OUTBOUND_SAFETY_PORT,
    CHAT_LABEL_PORT,
    WHATSAPP_SESSION_PORT,
    LLM_PORT,
    OBJECT_STORAGE_PORT,
    RUNTIME_ENVIRONMENT_PORT,
    CLOCK_PORT,
    RECEIPT_IMAGE_CLASSIFIER_PORT,
  ],
})
export class PortsModule {}
