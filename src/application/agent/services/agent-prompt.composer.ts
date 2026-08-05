import { Inject, Injectable, Logger } from '@nestjs/common';

import { sanitizeBusinessNotes } from '@domain/agent/prompt/sanitize-business-notes';
import {
  PromptChannel,
  PromptLayer,
} from '@domain/agent/prompt/prompt-fragment';
import {
  buildSystemPrompt,
  ComposedSystemPrompt,
} from '@domain/agent/prompt/system-prompt.builder';
import { TenantVoice } from '@domain/agent/prompt/tenant-voice';
import {
  PROMPT_CATALOG_PORT,
  PromptCatalogPort,
} from '@domain/agent/ports/prompt-catalog.port';
import { BusinessConfig } from '@domain/business-config/entities/business-config.entity';
import {
  categoryLexicon,
  DEFAULT_BUSINESS_CATEGORY,
} from '@domain/business-config/value-objects/business-category.vo';

export interface ComposePromptInput {
  config: BusinessConfig;
  timezone: string;
  channel: PromptChannel;
  now: Date;
}

const PROMPT_LOCALE = 'es';

// 24h on purpose: "03:00 p. m." is one more thing the model can read wrong.
const NOW_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

@Injectable()
export class AgentPromptComposer {
  private readonly logger = new Logger(AgentPromptComposer.name);

  constructor(
    @Inject(PROMPT_CATALOG_PORT)
    private readonly catalog: PromptCatalogPort,
  ) {}

  async compose(input: ComposePromptInput): Promise<ComposedSystemPrompt> {
    const category = input.config.businessCategory ?? DEFAULT_BUSINESS_CATEGORY;
    const voice = this.voiceOf(input.config);
    const set = await this.catalog.findFor({
      category,
      locale: PROMPT_LOCALE,
      channel: input.channel,
      tone: voice.tone,
      emojiPolicy: voice.emojiPolicy,
    });

    if (
      !set.fragments.some((fragment) => fragment.layer === PromptLayer.CATEGORY)
    ) {
      this.logger.warn(
        `No category prompt fragments for "${category}": answering with the platform layer only`,
      );
    }

    return buildSystemPrompt({
      revision: set.revision,
      fragments: set.fragments,
      category,
      lexicon: categoryLexicon(category),
      voice,
      nowLabel: this.formatNow(input.now, input.timezone),
      timezone: input.timezone,
    });
  }

  private voiceOf(config: BusinessConfig): TenantVoice {
    return {
      agentName: config.agentName,
      tone: config.tone,
      emojiPolicy: config.agentPolicy.emojiPolicy,
      businessNotes: sanitizeBusinessNotes(config.agentPolicy.businessNotes),
    };
  }

  // No seconds: the volatile block stays identical within the same minute.
  private formatNow(now: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('es-BO', {
        ...NOW_FORMAT,
        timeZone: timezone,
      }).format(now);
    } catch {
      this.logger.warn(
        `Unusable tenant timezone "${timezone}": dating the prompt in UTC`,
      );
      return new Intl.DateTimeFormat('es-BO', {
        ...NOW_FORMAT,
        timeZone: 'UTC',
      }).format(now);
    }
  }
}
