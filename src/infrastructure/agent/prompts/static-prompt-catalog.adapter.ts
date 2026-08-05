import { Injectable } from '@nestjs/common';

import { promptHash } from '@domain/agent/prompt/prompt-hash';
import { PromptFragment } from '@domain/agent/prompt/prompt-fragment';
import {
  PromptCatalogPort,
  PromptFragmentCriteria,
  PromptFragmentSet,
} from '@domain/agent/ports/prompt-catalog.port';
import { DEFAULT_BUSINESS_CATEGORY } from '@domain/business-config/value-objects/business-category.vo';

import { CATEGORY_FRAGMENTS } from './category.fragments';
import { CHANNEL_FRAGMENTS } from './channel.fragments';
import { PLATFORM_FRAGMENTS } from './platform.fragments';
import {
  EMOJI_FRAGMENTS,
  GUARD_FRAGMENTS,
  NOTES_FRAGMENTS,
  TONE_FRAGMENTS,
  VOLATILE_FRAGMENTS,
} from './voice.fragments';

// Every fragment shipped in this build, hashed once: the revision changes as soon as any
// wording changes, which is what makes a stored fingerprint traceable to a release.
const REVISION = promptHash(
  JSON.stringify([
    PLATFORM_FRAGMENTS,
    CHANNEL_FRAGMENTS,
    CATEGORY_FRAGMENTS,
    TONE_FRAGMENTS,
    EMOJI_FRAGMENTS,
    NOTES_FRAGMENTS,
    GUARD_FRAGMENTS,
    VOLATILE_FRAGMENTS,
  ]),
);

// Prompts are authored in code so they go through review, and read through a port so a
// database-backed registry can replace this adapter without touching domain or use cases.
@Injectable()
export class StaticPromptCatalogAdapter implements PromptCatalogPort {
  findFor(criteria: PromptFragmentCriteria): Promise<PromptFragmentSet> {
    const fragments: PromptFragment[] = [
      ...PLATFORM_FRAGMENTS,
      ...(CHANNEL_FRAGMENTS[criteria.channel] ?? []),
      ...(CATEGORY_FRAGMENTS[criteria.category] ??
        CATEGORY_FRAGMENTS[DEFAULT_BUSINESS_CATEGORY]),
      ...(TONE_FRAGMENTS[criteria.tone] ?? []),
      ...(EMOJI_FRAGMENTS[criteria.emojiPolicy] ?? []),
      ...NOTES_FRAGMENTS,
      ...GUARD_FRAGMENTS,
      ...VOLATILE_FRAGMENTS,
    ];

    return Promise.resolve({ revision: REVISION, fragments });
  }
}
