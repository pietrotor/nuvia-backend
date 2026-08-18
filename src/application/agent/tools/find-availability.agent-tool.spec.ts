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
          lastStartBefore: null,
          firstStartAfter: null,
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
          lastStartBefore: null,
          firstStartAfter: null,
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
      unavailableDays: { label: string; reason: string; detail: string }[];
    };

    expect(data.unavailableDays[0]).toEqual({
      label: 'domingo 9 de agosto',
      reason: AvailabilityReason.BUSINESS_CLOSED,
      detail: 'El negocio no atiende ese día.',
    });
  });

  it('says a preferred hour is occupied and names the bookable exits', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        preferred: {
          at: new Date('2026-08-10T13:30:00.000Z'),
          available: false,
          reason: AvailabilityReason.TAKEN,
          lastStartThatFits: null,
          leadTimeHours: null,
          lastStartBefore: new Date('2026-08-10T13:15:00.000Z'),
          firstStartAfter: new Date('2026-08-10T14:45:00.000Z'),
          professionalId: null,
          professionalName: null,
        },
      }),
    );

    const result = await tool.execute(validInput, context);
    const data = result.data as {
      mode: string;
      preferred: { detail: string };
    };

    expect(data.mode).toBe('resolve_exact_time');
    expect(data.preferred.detail).toContain('ocupada');
    expect(data.preferred.detail).toContain('09:15');
    expect(data.preferred.detail).toContain('10:45');
    expect(result.offerableTimes).toEqual(
      expect.arrayContaining(['09:30', '09:15', '10:45']),
    );
  });

  it('translates every unavailability reason into a concrete sentence', async () => {
    const reasons = Object.values(AvailabilityReason).filter(
      (reason) => reason !== AvailabilityReason.AVAILABLE,
    );

    for (const reason of reasons) {
      findOptions.execute.mockResolvedValue(
        answer({
          preferred: {
            at: new Date('2026-08-10T15:00:00.000Z'),
            available: false,
            reason,
            lastStartThatFits:
              reason === AvailabilityReason.SERVICE_DOES_NOT_FIT
                ? new Date('2026-08-10T14:00:00.000Z')
                : null,
            leadTimeHours: reason === AvailabilityReason.TOO_SOON ? 2 : null,
            lastStartBefore: null,
            firstStartAfter: null,
            professionalId: null,
            professionalName: null,
          },
        }),
      );

      const result = await tool.execute(validInput, context);
      const data = result.data as { preferred: { detail: string | null } };
      expect(data.preferred.detail).toEqual(expect.any(String));
      expect(data.preferred.detail!.length).toBeGreaterThan(0);
    }
  });

  it('presents a specific day as ranges and isolated starts without sampled options', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        slots: [
          {
            startsAt: new Date('2026-08-10T13:00:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
          {
            startsAt: new Date('2026-08-10T13:15:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
          {
            startsAt: new Date('2026-08-10T13:30:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
          {
            startsAt: new Date('2026-08-10T19:00:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
        ],
        options: [
          {
            startsAt: new Date('2026-08-10T15:00:00.000Z'),
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
      mode: string;
      dayLabel: string;
      segments: (
        | { kind: 'range'; from: string; to: string }
        | { kind: 'times'; times: { label: string }[] }
      )[];
      options?: unknown;
    };

    expect(data.mode).toBe('show_day_schedule');
    expect(data.dayLabel).toBe('lunes 10 de agosto');
    expect(data.segments).toEqual([
      {
        kind: 'range',
        label: 'se puede empezar entre 09:00 y 09:30',
        from: '09:00',
        to: '09:30',
      },
      {
        kind: 'times',
        times: [
          expect.objectContaining({
            label: '15:00',
            professionalName: 'Camila',
          }),
        ],
      },
    ]);
    expect(data.options).toBeUndefined();
    expect(result.offerableTimes).toEqual(
      expect.arrayContaining(['09:00', '09:30', '15:00']),
    );
    expect(result.offerableTimes).not.toContain('09:15');
    expect((result.nextActions ?? []).join(' ')).toContain('segments');
  });

  it('presents multiple days as day parts without exact times', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        slots: [
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
      {
        ...validInput,
        preferredAt: undefined,
        to: '2026-08-12T00:00:00-04:00',
      },
      context,
    );
    const data = result.data as {
      mode: string;
      days: { label: string; periods: string[] }[];
      options?: unknown;
    };

    expect(data.mode).toBe('choose_day_and_period');
    expect(data.days).toEqual([
      { label: 'lunes 10 de agosto', periods: ['mañana'] },
      { label: 'martes 11 de agosto', periods: ['mañana'] },
    ]);
    expect(data.options).toBeUndefined();
    expect(result.offerableTimes).toEqual([]);
    expect((result.nextActions ?? []).join(' ')).toContain('qué día y franja');
  });

  it('filters a specific day by the requested day part', async () => {
    findOptions.execute.mockResolvedValue(
      answer({
        slots: [
          {
            startsAt: new Date('2026-08-10T15:45:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
          ...['16:00', '16:15', '16:30'].map((utcHm) => ({
            startsAt: new Date(`2026-08-10T${utcHm}:00.000Z`),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          })),
          {
            startsAt: new Date('2026-08-10T22:00:00.000Z'),
            professionalId: PROFESSIONAL_ID,
            professionalName: 'Camila',
          },
        ],
      }),
    );

    const result = await tool.execute(
      {
        ...validInput,
        preferredAt: undefined,
        dayPart: 'afternoon',
      },
      context,
    );
    const data = result.data as {
      requestedPeriod: string;
      segments: { kind: string; from: string; to: string }[];
    };

    expect(data.requestedPeriod).toBe('tarde');
    expect(data.segments).toEqual([
      expect.objectContaining({
        kind: 'range',
        from: '12:00',
        to: '12:30',
      }),
    ]);
    expect(result.offerableTimes).toEqual(['12:00', '12:30']);
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
      'No preguntar profesional',
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

  // The client asked for the service, not for anyone in particular: blaming "esa
  // profesional" invents a request she never made.
  it('keeps the answer about the service when the client named no professional', async () => {
    findOptions.execute.mockRejectedValue(new SlotUnavailableError());

    const result = await tool.execute(validInput, context);

    expect(result.status).toBe('warning');
    expect(result.summary).not.toContain('Esa profesional');
    expect(result.summary).toContain('ese servicio');
  });

  it('lets a broken schedule lookup fail instead of dressing it as an answer', async () => {
    findOptions.execute.mockRejectedValue(new Error('connection terminated'));

    await expect(tool.execute(validInput, context)).rejects.toThrow(
      'connection terminated',
    );
  });
});
