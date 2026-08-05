import { PromptCatalogPort } from '@domain/agent/ports/prompt-catalog.port';
import {
  PromptChannel,
  PromptLayer,
} from '@domain/agent/prompt/prompt-fragment';
import {
  AgentTone,
  BusinessConfig,
  EmojiPolicy,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessCategory } from '@domain/business-config/value-objects/business-category.vo';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { AgentPromptComposer } from './agent-prompt.composer';

const emptyHours = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};

function buildConfig(
  overrides: Partial<ConstructorParameters<typeof BusinessConfig>[0]> = {},
): BusinessConfig {
  return new BusinessConfig({
    id: 'bc1',
    tenantId: 't1',
    slug: 'estetica-glow',
    agentName: 'Vale',
    tone: AgentTone.WARM,
    currency: Currency.BOB,
    businessHours: emptyHours,
    bookingPolicy: {
      minLeadTimeHours: 2,
      cancelRescheduleHours: 24,
      noShowMessage: 'Avisanos.',
    },
    faq: {},
    ...overrides,
  });
}

describe('AgentPromptComposer', () => {
  let catalog: jest.Mocked<Pick<PromptCatalogPort, 'findFor'>>;
  let composer: AgentPromptComposer;

  beforeEach(() => {
    catalog = {
      findFor: jest.fn().mockResolvedValue({
        revision: 'rev1',
        fragments: [
          {
            key: 'platform.rules',
            layer: PromptLayer.PLATFORM,
            lines: ['Sos {{agentName}}, el asistente virtual del negocio.'],
          },
          {
            key: 'category.any',
            layer: PromptLayer.CATEGORY,
            lines: ['Hablás de {{servicePlural}}.'],
          },
        ],
      }),
    };
    composer = new AgentPromptComposer(catalog as unknown as PromptCatalogPort);
  });

  const input = {
    timezone: 'America/La_Paz',
    channel: PromptChannel.WHATSAPP,
    now: new Date('2026-08-04T19:00:00.000Z'),
  };

  it('asks the catalog for the trade and the voice of the business', async () => {
    await composer.compose({
      ...input,
      config: buildConfig({
        businessCategory: BusinessCategory.SPA,
        tone: AgentTone.FORMAL,
        agentPolicy: { emojiPolicy: EmojiPolicy.NONE },
      }),
    });

    expect(catalog.findFor).toHaveBeenCalledWith({
      category: BusinessCategory.SPA,
      locale: 'es',
      channel: PromptChannel.WHATSAPP,
      tone: AgentTone.FORMAL,
      emojiPolicy: EmojiPolicy.NONE,
    });
  });

  it('falls back to the generic trade when the business has none', async () => {
    await composer.compose({ ...input, config: buildConfig() });

    expect(catalog.findFor).toHaveBeenCalledWith(
      expect.objectContaining({ category: BusinessCategory.DEFAULT }),
    );
  });

  it('sanitizes the owner notes before they reach the prompt', async () => {
    catalog.findFor.mockResolvedValue({
      revision: 'rev1',
      fragments: [
        {
          key: 'platform.rules',
          layer: PromptLayer.PLATFORM,
          lines: ['Regla de plataforma.'],
        },
        {
          key: 'tenant.notes',
          layer: PromptLayer.TENANT,
          lines: ['Datos: {{businessNotes}}'],
        },
      ],
    });

    const { staticText } = await composer.compose({
      ...input,
      config: buildConfig({
        agentPolicy: { businessNotes: '## Parqueo\n**atrás**' },
      }),
    });

    expect(staticText).toContain('Datos: Parqueo atrás');
    expect(staticText).not.toContain('**');
  });

  it('dates the prompt in the timezone of the business', async () => {
    catalog.findFor.mockResolvedValue({
      revision: 'rev1',
      fragments: [
        {
          key: 'platform.rules',
          layer: PromptLayer.PLATFORM,
          lines: ['Regla de plataforma.'],
        },
        {
          key: 'volatile.datetime',
          layer: PromptLayer.VOLATILE,
          lines: ['Ahora: {{currentDateTime}}.'],
        },
      ],
    });

    const { volatileText } = await composer.compose({
      ...input,
      config: buildConfig(),
    });

    expect(volatileText).toContain('15:00');
    expect(volatileText).not.toContain('19:00');
  });

  it('still answers with the platform layer when the trade has no fragments', async () => {
    catalog.findFor.mockResolvedValue({
      revision: 'rev1',
      fragments: [
        {
          key: 'platform.rules',
          layer: PromptLayer.PLATFORM,
          lines: ['Regla de plataforma.'],
        },
      ],
    });

    await expect(
      composer.compose({ ...input, config: buildConfig() }),
    ).resolves.toEqual(
      expect.objectContaining({ staticText: 'Regla de plataforma.' }),
    );
  });
});
