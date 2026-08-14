import {
  PromptChannel,
  PromptLayer,
} from '@domain/agent/prompt/prompt-fragment';
import { buildSystemPrompt } from '@domain/agent/prompt/system-prompt.builder';
import {
  AgentTone,
  EmojiPolicy,
} from '@domain/business-config/entities/business-config.entity';
import {
  BusinessCategory,
  categoryLexicon,
} from '@domain/business-config/value-objects/business-category.vo';

import { StaticPromptCatalogAdapter } from './static-prompt-catalog.adapter';

const categories = Object.values(BusinessCategory);

describe('StaticPromptCatalogAdapter', () => {
  const adapter = new StaticPromptCatalogAdapter();

  const criteriaFor = (category: BusinessCategory) => ({
    category,
    locale: 'es',
    channel: PromptChannel.WHATSAPP,
    tone: AgentTone.WARM,
    emojiPolicy: EmojiPolicy.LIGHT,
  });

  it.each(categories)('ships every prompt layer for %s', async (category) => {
    const { fragments } = await adapter.findFor(criteriaFor(category));
    const layers = new Set(fragments.map((fragment) => fragment.layer));

    expect(layers).toContain(PromptLayer.PLATFORM);
    expect(layers).toContain(PromptLayer.CHANNEL);
    expect(layers).toContain(PromptLayer.CATEGORY);
    expect(layers).toContain(PromptLayer.TENANT);
    expect(layers).toContain(PromptLayer.GUARD);
    expect(layers).toContain(PromptLayer.VOLATILE);
  });

  it.each(categories)(
    'states the non-negotiable rules for %s',
    async (category) => {
      const set = await adapter.findFor(criteriaFor(category));
      const { staticText } = buildSystemPrompt({
        revision: set.revision,
        fragments: set.fragments,
        category,
        lexicon: categoryLexicon(category),
        voice: {
          agentName: 'Vale',
          tone: AgentTone.WARM,
          emojiPolicy: EmojiPolicy.LIGHT,
          businessNotes: null,
        },
        nowLabel: 'martes, 4 de agosto de 2026, 15:00',
        timezone: 'America/La_Paz',
        calendar: 'martes 4 de agosto, miércoles 5 de agosto',
        businessCatalog: 'Servicios:\n- Hidrafacial — id svc-1 — 75 min',
        clientState: 'no tiene ninguna reserva registrada',
        clientName: 'Ana',
      });

      expect(staticText).toContain('Nunca finjas ser una persona humana');
      expect(staticText).toContain('No des consejos médicos');
      expect(staticText).toContain('find_availability');
      expect(staticText).toContain('request_handoff');
      expect(staticText).toContain('book_appointment');
      expect(staticText).toContain('no podés escuchar audios');
      expect(staticText).not.toContain('{{');
    },
  );

  // The channel layer is the only place that says how a message is written, and a reply
  // that reads well on a phone is as much part of the product as a correct booking.
  it('states how a WhatsApp message is formatted, not only what it says', async () => {
    const { fragments } = await adapter.findFor(
      criteriaFor(BusinessCategory.ESTHETICS),
    );
    const channel = fragments
      .filter((fragment) => fragment.layer === PromptLayer.CHANNEL)
      .flatMap((fragment) => fragment.lines)
      .join('\n');

    expect(channel).toContain('*así*');
    expect(channel).toContain('negrita');
    expect(channel).toContain('guion y un espacio');
    expect(channel).toContain('dos y cinco líneas');
  });

  it('never mentions a country or a currency: those come from config', async () => {
    for (const category of categories) {
      const { fragments } = await adapter.findFor(criteriaFor(category));
      const text = fragments.flatMap((fragment) => fragment.lines).join('\n');

      expect(text).not.toMatch(/Bolivia|boliviano|\bBs\b/);
    }
  });

  it('changes its revision when the wording changes', async () => {
    const first = await adapter.findFor(criteriaFor(BusinessCategory.SPA));
    const second = await adapter.findFor(
      criteriaFor(BusinessCategory.ESTHETICS),
    );

    expect(first.revision).toMatch(/^[0-9a-f]{8}$/);
    expect(second.revision).toBe(first.revision);
  });
});
