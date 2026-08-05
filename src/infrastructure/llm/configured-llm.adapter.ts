import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  LlmChatInput,
  LlmChatResult,
  LlmPort,
} from '@domain/agent/ports/llm.port';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import { AnthropicLlmAdapter } from './anthropic-llm.adapter';
import { OpenAiCompatibleLlmAdapter } from './openai-compatible-llm.adapter';

@Injectable()
export class ConfiguredLlmAdapter implements LlmPort {
  constructor(
    private readonly config: ConfigService,
    private readonly anthropic: AnthropicLlmAdapter,
    private readonly openAiCompatible: OpenAiCompatibleLlmAdapter,
  ) {}

  chat(input: LlmChatInput): Promise<LlmChatResult> {
    const provider = this.config.get<string>(
      'LLM_PROVIDER',
      'openai-compatible',
    );
    switch (provider) {
      case 'anthropic':
        return this.anthropic.chat(input);
      case 'openai-compatible':
        return this.openAiCompatible.chat(input);
      default:
        throw new InternalError(ErrorCode.LLM_NOT_CONFIGURED, { provider });
    }
  }
}
