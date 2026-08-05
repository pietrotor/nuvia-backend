import {
  AgentTone,
  EmojiPolicy,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessCategory } from '@domain/business-config/value-objects/business-category.vo';

import { PromptChannel, PromptFragment } from '../prompt/prompt-fragment';

export interface PromptFragmentCriteria {
  category: BusinessCategory;
  locale: string;
  channel: PromptChannel;
  tone: AgentTone;
  emojiPolicy: EmojiPolicy;
}

export interface PromptFragmentSet {
  // Changes whenever the wording of any fragment changes, so a stored fingerprint
  // identifies the exact prompt a message was answered with.
  revision: string;
  fragments: PromptFragment[];
}

// Read-only on purpose: authoring and publishing prompts is a separate concern that the
// agent must not be able to reach.
export interface PromptCatalogPort {
  findFor(criteria: PromptFragmentCriteria): Promise<PromptFragmentSet>;
}

export const PROMPT_CATALOG_PORT = 'PromptCatalogPort';
