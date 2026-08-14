import {
  BusinessCategory,
  CategoryLexicon,
} from '@domain/business-config/value-objects/business-category.vo';

import { PromptPlatformLayerMissingError } from '../exceptions/prompt.exceptions';
import { LAYER_ORDER, PromptFragment, PromptLayer } from './prompt-fragment';
import { promptHash } from './prompt-hash';
import { TenantVoice } from './tenant-voice';

export interface SystemPromptInput {
  revision: string;
  fragments: PromptFragment[];
  category: BusinessCategory;
  lexicon: CategoryLexicon;
  voice: TenantVoice;
  nowLabel: string;
  timezone: string;
  calendar: string;
  businessCatalog: string;
  clientState: string;
  // Empty when WhatsApp gave no usable profile name, which drops the fragment that greets
  // her by name instead of rendering a placeholder.
  clientName: string;
}

export interface ComposedSystemPrompt {
  // Same for every message of a tenant, so a provider can cache it as a prefix.
  staticText: string;
  volatileText: string;
  fingerprint: string;
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

export function buildSystemPrompt(
  input: SystemPromptInput,
): ComposedSystemPrompt {
  const values: Record<string, string> = {
    agentName: input.voice.agentName,
    client: input.lexicon.client,
    clientName: input.clientName,
    professional: input.lexicon.professional,
    professionalPlural: input.lexicon.professionalPlural,
    service: input.lexicon.service,
    servicePlural: input.lexicon.servicePlural,
    session: input.lexicon.session,
    sessionPlural: input.lexicon.sessionPlural,
    businessNotes: input.voice.businessNotes ?? '',
    currentDateTime: input.nowLabel,
    timezone: input.timezone,
    calendar: input.calendar,
    businessCatalog: input.businessCatalog,
    clientState: input.clientState,
  };

  const linesOf = (layer: PromptLayer): string[] =>
    input.fragments
      .filter((fragment) => fragment.layer === layer)
      .map((fragment) => render(fragment, values))
      .filter((lines): lines is string[] => lines !== null)
      .flat();

  const platform = linesOf(PromptLayer.PLATFORM);
  if (platform.length === 0) {
    throw new PromptPlatformLayerMissingError();
  }

  const staticLines = LAYER_ORDER.flatMap((layer) =>
    layer === PromptLayer.PLATFORM ? platform : linesOf(layer),
  );

  return {
    staticText: staticLines.join('\n'),
    volatileText: linesOf(PromptLayer.VOLATILE).join('\n'),
    fingerprint: `${input.revision}.${input.category}.${promptHash(
      voiceSignature(input.voice),
    )}`,
  };
}

// A fragment is dropped when a placeholder it depends on has no value: that is how an
// optional layer (the owner's notes, for instance) disappears without the fragments
// needing conditionals.
function render(
  fragment: PromptFragment,
  values: Record<string, string>,
): string[] | null {
  const rendered: string[] = [];
  for (const line of fragment.lines) {
    let missing = false;
    const text = line.replace(PLACEHOLDER, (_match, key: string) => {
      const value = values[key] ?? '';
      if (!value) missing = true;
      return value;
    });
    if (missing) return null;
    rendered.push(text);
  }
  return rendered;
}

function voiceSignature(voice: TenantVoice): string {
  return [
    voice.agentName,
    voice.tone,
    voice.emojiPolicy,
    voice.businessNotes ?? '',
  ].join('|');
}
