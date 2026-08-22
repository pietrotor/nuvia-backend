import { PromptCatalogPort } from '@domain/agent/ports/prompt-catalog.port';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
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
import { Money } from '@domain/common/value-objects/money.vo';
import { WeeklyHours } from '@domain/business-config/entities/business-config.entity';
import { Service } from '@domain/services/entities/service.entity';
import { AgentPromptComposer } from './agent-prompt.composer';

const emptyHours: WeeklyHours = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};

const BRANCH_ID = 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

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
    bookingPolicy: {
      minLeadTimeHours: 2,
      cancelRescheduleHours: 24,
      noShowMessage: 'Avisanos.',
    },
    faq: {},
    ...overrides,
  });
}

function buildBranch(
  overrides: Partial<{
    id: string;
    name: string;
    address: string | null;
    weeklyHours: WeeklyHours;
  }> = {},
) {
  return {
    id: BRANCH_ID,
    name: 'Sede Centro',
    address: 'Calle 1',
    weeklyHours: emptyHours,
    ...overrides,
  };
}

describe('AgentPromptComposer', () => {
  let catalog: jest.Mocked<Pick<PromptCatalogPort, 'findFor'>>;
  let clients: { findById: jest.Mock };
  let listClientAppointments: { execute: jest.Mock };
  let listBranches: { execute: jest.Mock };
  let listBranchServices: { execute: jest.Mock };
  let listBranchProfessionals: { execute: jest.Mock };
  let listServices: { execute: jest.Mock };
  let listProfessionals: { execute: jest.Mock };
  let composer: AgentPromptComposer;

  beforeEach(() => {
    clients = {
      findById: jest.fn().mockResolvedValue({ name: 'Ana Quiroga' }),
    };
    listClientAppointments = { execute: jest.fn().mockResolvedValue([]) };
    listBranches = {
      execute: jest.fn().mockResolvedValue([buildBranch()]),
    };
    listBranchServices = { execute: jest.fn().mockResolvedValue([]) };
    listBranchProfessionals = { execute: jest.fn().mockResolvedValue([]) };
    listServices = { execute: jest.fn().mockResolvedValue([]) };
    listProfessionals = { execute: jest.fn().mockResolvedValue([]) };
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
    composer = new AgentPromptComposer(
      catalog as unknown as PromptCatalogPort,
      clients as never,
      listClientAppointments as never,
      listBranches as never,
      listBranchServices as never,
      listBranchProfessionals as never,
      listServices as never,
      listProfessionals as never,
    );
  });

  const input = {
    timezone: 'America/La_Paz',
    channel: PromptChannel.WHATSAPP,
    now: new Date('2026-08-04T19:00:00.000Z'),
    clientId: 'client-id',
    branchId: BRANCH_ID,
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

  describe('client name', () => {
    beforeEach(() => {
      catalog.findFor.mockResolvedValue({
        revision: 'rev1',
        fragments: [
          {
            key: 'platform.rules',
            layer: PromptLayer.PLATFORM,
            lines: ['Regla de plataforma.'],
          },
          {
            key: 'volatile.client_name',
            layer: PromptLayer.VOLATILE,
            lines: ['Se llama {{clientName}}.'],
          },
        ],
      });
    });

    it('hands the agent the first name to greet her with', async () => {
      const { volatileText } = await composer.compose({
        ...input,
        config: buildConfig(),
      });

      expect(clients.findById).toHaveBeenCalledWith('client-id');
      expect(volatileText).toContain('Se llama Ana.');
    });

    it('drops the greeting when WhatsApp gave no usable name', async () => {
      clients.findById.mockResolvedValue({ name: 'Cliente 1998' });

      const { volatileText } = await composer.compose({
        ...input,
        config: buildConfig(),
      });

      expect(volatileText).toBe('');
    });
  });

  describe('client state', () => {
    beforeEach(() => {
      catalog.findFor.mockResolvedValue({
        revision: 'rev1',
        fragments: [
          {
            key: 'platform.rules',
            layer: PromptLayer.PLATFORM,
            lines: ['Regla de plataforma.'],
          },
          {
            key: 'volatile.client_state',
            layer: PromptLayer.VOLATILE,
            lines: ['Agenda: {{clientState}}'],
          },
        ],
      });
    });

    it('states that the client has no booking when the schedule is empty', async () => {
      const { volatileText } = await composer.compose({
        ...input,
        config: buildConfig(),
      });

      expect(listClientAppointments.execute).toHaveBeenCalledWith({
        clientId: 'client-id',
        onlyUpcoming: true,
        scope: 'managed',
      });
      expect(volatileText).toContain('no tiene ninguna reserva registrada');
    });

    it('lists the real appointments in the timezone of the business', async () => {
      listClientAppointments.execute.mockResolvedValue([
        {
          appointment: {
            startsAt: new Date('2026-08-09T20:00:00.000Z'),
            status: AppointmentStatus.PENDING_DEPOSIT,
          },
          professional: { name: 'Camila Rojas' },
          service: { name: 'Hidrafacial' },
        },
      ]);

      const { volatileText } = await composer.compose({
        ...input,
        config: buildConfig(),
      });

      expect(volatileText).toContain('Hidrafacial con Camila Rojas');
      expect(volatileText).toContain('16:00');
      expect(volatileText).toContain('esperando la seña');
    });
  });

  describe('business catalog', () => {
    const CAMILA_ID = '2f6ba7e0-5c1a-4a5e-9a3f-1c0f7c9d2b11';
    const HIDRAFACIAL_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

    const openWeekdays = {
      ...emptyHours,
      mon: { start: '09:00', end: '18:00' },
    };

    beforeEach(() => {
      catalog.findFor.mockResolvedValue({
        revision: 'rev1',
        fragments: [
          {
            key: 'platform.rules',
            layer: PromptLayer.PLATFORM,
            lines: ['Regla de plataforma.'],
          },
          {
            key: 'volatile.catalog',
            layer: PromptLayer.VOLATILE,
            lines: ['Catálogo: {{businessCatalog}}'],
          },
        ],
      });
      listBranches.execute.mockResolvedValue([
        buildBranch({ weeklyHours: openWeekdays }),
      ]);
      listBranchProfessionals.execute.mockResolvedValue([
        {
          professionalId: CAMILA_ID,
          weeklyHours: { ...emptyHours, mon: { start: '09:00', end: '18:00' } },
          isActive: true,
        },
      ]);
      listProfessionals.execute.mockResolvedValue([
        {
          id: CAMILA_ID,
          name: 'Camila Rojas',
          isActive: true,
        },
      ]);
      listBranchServices.execute.mockResolvedValue([
        {
          serviceId: HIDRAFACIAL_ID,
          priceOverrideAmount: null,
          depositAmountOverrideAmount: null,
          depositQrId: null,
          isActive: true,
        },
      ]);
      listServices.execute.mockResolvedValue([
        new Service({
          id: HIDRAFACIAL_ID,
          tenantId: 't1',
          name: 'Hidrafacial',
          durationMinutes: 75,
          currency: Currency.BOB,
          price: '280.00',
          requiresDeposit: false,
          depositAmount: null,
          depositPercent: null,
          depositQrId: null,
          clientChoosesProfessional: true,
          isActive: true,
          professionalIds: [CAMILA_ID],
        }),
      ]);
    });

    // The identifier is the whole point: without it the model books with one it invented.
    it('carries the real identifiers into every turn', async () => {
      const { volatileText } = await composer.compose({
        ...input,
        config: buildConfig(),
      });

      expect(volatileText).toContain(CAMILA_ID);
      expect(volatileText).toContain(HIDRAFACIAL_ID);
      expect(volatileText).toContain('lo hacen Camila Rojas');
      expect(volatileText).toContain(
        Money.of('280.00', Currency.BOB).display(),
      );
    });

    it('states the days worked so no one is offered on a day off', async () => {
      const { volatileText } = await composer.compose({
        ...input,
        config: buildConfig(),
      });

      expect(volatileText).toContain('trabaja lunes');
      expect(volatileText).not.toContain('09:00');
      expect(volatileText).not.toContain('domingo');
    });

    // The schedule honours the intersection, so anything else here is a day the agent would
    // offer and the booking would then reject.
    it('narrows the days worked to the hours the branch is open', async () => {
      listBranchProfessionals.execute.mockResolvedValue([
        {
          professionalId: CAMILA_ID,
          weeklyHours: {
            ...emptyHours,
            mon: { start: '08:00', end: '20:00' },
            sun: { start: '09:00', end: '18:00' },
          },
          isActive: true,
        },
      ]);

      const { volatileText } = await composer.compose({
        ...input,
        config: buildConfig(),
      });

      expect(volatileText).toContain('trabaja lunes');
      expect(volatileText).not.toContain('domingo');
    });

    it('leaves out what the branch turned off', async () => {
      listBranchServices.execute.mockResolvedValue([]);

      const { volatileText } = await composer.compose({
        ...input,
        config: buildConfig(),
      });

      expect(volatileText).not.toContain('Hidrafacial');
    });

    it('drops the whole block for a business with nothing loaded yet', async () => {
      listBranches.execute.mockResolvedValue([]);
      listBranchServices.execute.mockResolvedValue([]);
      listBranchProfessionals.execute.mockResolvedValue([]);

      const { volatileText } = await composer.compose({
        ...input,
        branchId: null,
        config: buildConfig(),
      });

      expect(volatileText).toBe('');
    });

    it('lists branches with services when several are active and none is pinned', async () => {
      listBranches.execute.mockResolvedValue([
        buildBranch({ id: 'branch-a', name: 'Centro', address: 'Calle 1' }),
        buildBranch({ id: 'branch-b', name: 'Sur', address: 'Calle 2' }),
      ]);

      const { volatileText } = await composer.compose({
        ...input,
        branchId: null,
        config: buildConfig(),
      });

      expect(volatileText).toContain('Sucursales');
      expect(volatileText).toContain('Centro');
      expect(volatileText).toContain('Sur');
      expect(volatileText).toContain('Hidrafacial');
      expect(volatileText).toContain('No inventes sucursales');
      expect(volatileText).not.toContain('set_branch');
      expect(listBranchServices.execute).toHaveBeenCalled();
    });

    it('states a single-branch tenant has no other locations', async () => {
      const { volatileText } = await composer.compose({
        ...input,
        branchId: null,
        config: buildConfig(),
      });

      expect(volatileText).toContain(CAMILA_ID);
      expect(volatileText).toContain('Hidrafacial');
      expect(volatileText).toContain('tiene una sola sucursal');
      expect(volatileText).toContain('No existe ninguna otra');
    });
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
