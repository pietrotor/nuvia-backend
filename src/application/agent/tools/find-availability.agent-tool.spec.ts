import {
  AvailabilityOptions,
  AvailabilityReason,
  FindAvailabilityOptionsUseCase,
} from '@application/appointments/use-cases/find-availability-options.use-case';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Service } from '@domain/services/entities/service.entity';
import { AgentContext } from './agent-tool';
import { FindAvailabilityAgentTool } from './find-availability.agent-tool';

const SERVICE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const PROFESSIONAL_ID = '2f6ba7e0-5c1a-4a5e-9a3f-1c0f7c9d2b11';

const context: AgentContext = {
  tenantId: 'tenant-1',
  conversationId: 'conversation-1',
  clientId: '9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a',
  clientPhoneE164: '+59170000000',
  timezone: 'America/La_Paz',
  branchId: null,
};

const validInput = {
  serviceId: SERVICE_ID,
  from: '2026-08-10T00:00:00-04:00',
  to: '2026-08-10T23:59:59-04:00',
  preferredAt: '2026-08-10T15:00:00-04:00',
};

function serviceWith(clientChoosesProfessional: boolean): Service {
  return new Service({
    id: SERVICE_ID,
    tenantId: 't1',
    name: 'Hidrafacial',
    durationMinutes: 60,
    currency: Currency.BOB,
    price: '280.00',
    requiresDeposit: false,
    depositAmount: null,
    depositPercent: null,
    depositQrId: null,
    clientChoosesProfessional,
    isActive: true,
    professionalIds: [PROFESSIONAL_ID],
  });
}

function answer(
  overrides: Partial<AvailabilityOptions> = {},
): AvailabilityOptions {
  return {
    service: serviceWith(true),
    timezone: 'America/La_Paz',
    preferred: null,
    slots: [],
    options: [],
    availableDays: [],
    unavailableDays: [],
    nextAvailable: null,
    ...overrides,
  };
}

describe('FindAvailabilityAgentTool', () => {
  let findOptions: { execute: jest.Mock };
  let tool: FindAvailabilityAgentTool;

  beforeEach(() => {
    findOptions = { execute: jest.fn().mockResolvedValue(answer()) };
    tool = new FindAvailabilityAgentTool(
      findOptions as unknown as FindAvailabilityOptionsUseCase,
    );
  });

  it('searches every professional when the client did not name one', async () => {
    await tool.execute(validInput, context);

    expect(findOptions.execute).toHaveBeenCalledWith(
      expect.objectContaining({ professionalId: undefined }),
    );
  });

  it('forwards the hour the client asked for', async () => {
    await tool.execute(validInput, context);

    expect(findOptions.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredAt: new Date('2026-08-10T15:00:00-04:00'),
      }),
    );
  });

  it('rejects a range longer than a fortnight without asking the schedule', async () => {
    const result = await tool.execute(
      { ...validInput, to: '2026-09-30T00:00:00-04:00' },
      context,
    );

    expect(result.status).toBe('warning');
    expect(findOptions.execute).not.toHaveBeenCalled();
  });

  // Each reason has to reach the model with the one fact that makes the sentence natural:
  // "hasta las 17:00" or "necesitamos 2 horas", never a bare "no hay disponibilidad".
  it('carries the concrete fact behind a treatment that no longer fits', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        preferred: {
          at: new Date('2026-08-10T21:30:00.000Z'),
          available: false,
          reason: AvailabilityReason.SERVICE_DOES_NOT_FIT,
          lastStartThatFits: new Date('2026-08-10T21:00:00.000Z'),
          leadTimeHours: null,
          professionalId: null,
          professionalName: null,
        },
      }),
    );

    const result = await tool.execute(validInput, context);
    const data = result.data as { preferred: { detail: string } };

    expect(data.preferred.detail).toContain('17:00');
  });

  it('states how much notice the business needs', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        preferred: {
          at: new Date('2026-08-10T19:00:00.000Z'),
          available: false,
          reason: AvailabilityReason.TOO_SOON,
          lastStartThatFits: null,
          leadTimeHours: 2,
          professionalId: null,
          professionalName: null,
        },
      }),
    );

    const result = await tool.execute(validInput, context);
    const data = result.data as { preferred: { detail: string } };

    expect(data.preferred.detail).toContain('2 horas');
  });

  it('labels the days without service and why, in the hours the client keeps', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        unavailableDays: [
          {
            date: new Date('2026-08-09T04:00:00.000Z'),
            reason: AvailabilityReason.BUSINESS_CLOSED,
          },
        ],
      }),
    );

    const result = await tool.execute(validInput, context);
    const data = result.data as {
      unavailableDays: { label: string; reason: string }[];
    };

    expect(data.unavailableDays[0]).toEqual({
      label: 'domingo 9 de agosto',
      reason: AvailabilityReason.BUSINESS_CLOSED,
    });
  });

  it('drops the date from each option when every offer is the same local day', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        options: [
          {
            startsAt: new Date('2026-08-10T13:00:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
          {
            startsAt: new Date('2026-08-10T19:00:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
        ],
        availableDays: [
          {
            date: new Date('2026-08-10T13:00:00.000Z'),
            windows: [
              {
                from: new Date('2026-08-10T13:00:00.000Z'),
                to: new Date('2026-08-10T22:00:00.000Z'),
              },
            ],
          },
        ],
      }),
    );

    const result = await tool.execute(
      { ...validInput, preferredAt: undefined },
      context,
    );
    const data = result.data as {
      dayLabel: string;
      options: { label: string }[];
      availableDays: { label: string; ranges: string[] }[];
    };

    expect(data.dayLabel).toBe('lunes 10 de agosto');
    expect(data.options.map((option) => option.label)).toEqual([
      '09:00',
      '15:00',
    ]);
    expect(data.availableDays).toEqual([
      {
        label: 'lunes 10 de agosto',
        ranges: ['09:00 a 18:00'],
        lastStart: '17:00',
      },
    ]);
    expect((result.nextActions ?? []).join(' ')).toContain('availableDays');
  });

  it('keeps the full date on each option when they span more than one day', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        options: [
          {
            startsAt: new Date('2026-08-10T13:00:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
          {
            startsAt: new Date('2026-08-11T13:00:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
        ],
      }),
    );

    const result = await tool.execute(
      { ...validInput, preferredAt: undefined },
      context,
    );
    const data = result.data as {
      dayLabel: string | null;
      options: { label: string }[];
    };

    expect(data.dayLabel).toBeNull();
    expect(data.options.map((option) => option.label)).toEqual([
      'lunes 10 de agosto, 09:00',
      'martes 11 de agosto, 09:00',
    ]);
  });

  it('offers the next real opening rather than closing the conversation with a no', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        nextAvailable: {
          startsAt: new Date('2026-08-31T13:00:00.000Z'),
          professionalId: PROFESSIONAL_ID,
          professionalName: 'Camila',
          daysAway: 21,
        },
      }),
    );

    const result = await tool.execute(validInput, context);
    const data = result.data as { nextAvailable: { label: string } };

    expect(data.nextAvailable.label).toBe('lunes 31 de agosto, 09:00');
    expect((result.nextActions ?? []).join(' ')).toContain('21 días');
  });

  it('tells the model not to ask who, when the service does not let the client choose', async () => {
    findOptions.execute.mockResolvedValue(
      answer({ service: serviceWith(false) }),
    );

    const result = await tool.execute(validInput, context);
    const data = result.data as { clientChoosesProfessional: boolean };

    expect(data.clientChoosesProfessional).toBe(false);
    expect((result.nextActions ?? []).join(' ')).toContain(
      'no preguntes con quién',
    );
  });

  // A pairing the business does not offer is an answer, not a crash.
  it('explains a professional who does not perform the service', async () => {
    findOptions.execute.mockRejectedValue(new SlotUnavailableError());

    const result = await tool.execute(
      { ...validInput, professionalId: PROFESSIONAL_ID },
      context,
    );

    expect(result.status).toBe('warning');
    expect(result.summary).toContain('no realiza ese servicio');
  });
});
