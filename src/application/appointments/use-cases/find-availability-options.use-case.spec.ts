import {
  Appointment,
  AppointmentStatus,
} from '@domain/appointments/entities/appointment.entity';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { AppointmentRepository } from '@domain/appointments/repositories/appointment.repository';
import { Branch } from '@domain/branches/entities/branch.entity';
import { BranchProfessional } from '@domain/branches/entities/branch-professional.entity';
import { BranchService } from '@domain/branches/entities/branch-service.entity';
import { BranchProfessionalRepository } from '@domain/branches/repositories/branch-professional.repository';
import { BranchServiceRepository } from '@domain/branches/repositories/branch-service.repository';
import { resolveEffectiveBranchService } from '@domain/branches/services/effective-branch-service';
import {
  AgentTone,
  BusinessConfig,
  WeeklyHours,
} from '@domain/business-config/entities/business-config.entity';
import { intersectWeeklyHours } from '@domain/business-config/services/weekly-hours';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Money } from '@domain/common/value-objects/money.vo';
import { Professional } from '@domain/professionals/entities/professional.entity';
import { ScheduleBlock } from '@domain/schedule-blocks/entities/schedule-block.entity';
import { ScheduleBlockRepository } from '@domain/schedule-blocks/repositories/schedule-block.repository';
import { Service } from '@domain/services/entities/service.entity';
import { ServiceRepository } from '@domain/services/repositories/service.repository';
import {
  ScheduleContext,
  ScheduleContextResolver,
} from '../services/schedule-context-resolver.service';
import {
  AvailabilityReason,
  FindAvailabilityOptionsUseCase,
} from './find-availability-options.use-case';

const TIMEZONE = 'America/La_Paz';

// Weekdays 09:00 to 18:00, closed on Sunday.
const BRANCH_HOURS: WeeklyHours = {
  mon: { start: '09:00', end: '18:00' },
  tue: { start: '09:00', end: '18:00' },
  wed: { start: '09:00', end: '18:00' },
  thu: { start: '09:00', end: '18:00' },
  fri: { start: '09:00', end: '18:00' },
  sat: { start: '09:00', end: '13:00' },
  sun: null,
};

const CAMILA_HOURS: WeeklyHours = { ...BRANCH_HOURS, wed: null };
const VALERIA_HOURS: WeeklyHours = BRANCH_HOURS;

const config = new BusinessConfig({
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
});

const branch = new Branch({
  id: 'b1',
  tenantId: 't1',
  name: 'Centro',
  slug: 'centro',
  address: null,
  mapsUrl: null,
  phone: null,
  weeklyHours: BRANCH_HOURS,
  timezone: TIMEZONE,
  isPrimary: true,
  isActive: true,
});

const camila = new Professional({
  id: 'p-camila',
  tenantId: 't1',
  name: 'Camila',
  isActive: true,
});

const valeria = new Professional({
  id: 'p-valeria',
  tenantId: 't1',
  name: 'Valeria',
  isActive: true,
});

const hidrafacial = new Service({
  id: 's-hidrafacial',
  tenantId: 't1',
  name: 'Hidrafacial',
  durationMinutes: 60,
  currency: Currency.BOB,
  price: '280.00',
  requiresDeposit: false,
  depositAmount: null,
  depositPercent: null,
  depositQrId: null,
  clientChoosesProfessional: true,
  isActive: true,
  professionalIds: [camila.id, valeria.id],
});

// Monday 10 August 2026 in La Paz.
const MONDAY = {
  from: new Date('2026-08-10T04:00:00.000Z'),
  to: new Date('2026-08-11T03:59:59.000Z'),
};
// Nothing in this suite is ever within the lead time.
const EARLIEST_START = new Date('2026-08-01T00:00:00.000Z');

function contextFor(professional: Professional): ScheduleContext {
  const hours = professional.id === camila.id ? CAMILA_HOURS : VALERIA_HOURS;
  const branchProfessional = new BranchProfessional({
    tenantId: 't1',
    branchId: branch.id,
    professionalId: professional.id,
    weeklyHours: hours,
    isActive: true,
  });
  const branchService = new BranchService({
    tenantId: 't1',
    branchId: branch.id,
    serviceId: hidrafacial.id,
    priceOverrideAmount: null,
    depositAmountOverrideAmount: null,
    depositQrId: null,
    isActive: true,
  });

  return {
    branch,
    service: hidrafacial,
    effectiveService: resolveEffectiveBranchService(hidrafacial, branchService),
    professional,
    branchProfessional,
    config,
    timezone: TIMEZONE,
    weeklyHours: intersectWeeklyHours(branch.weeklyHours, hours),
    serviceWindowHours: null,
    earliestStartAt: EARLIEST_START,
  };
}

function busy(professionalId: string, startsAt: string): Appointment {
  return new Appointment({
    id: `a-${professionalId}-${startsAt}`,
    tenantId: 't1',
    branchId: branch.id,
    clientId: 'c1',
    professionalId,
    serviceId: hidrafacial.id,
    startsAt: new Date(startsAt),
    endsAt: new Date(Date.parse(startsAt) + 3_600_000),
    status: AppointmentStatus.CONFIRMED,
    price: Money.of('150.00', Currency.BOB),
  });
}

function holiday(professionalId: string): ScheduleBlock {
  return new ScheduleBlock({
    id: `b-${professionalId}`,
    tenantId: 't1',
    professionalId,
    startsAt: new Date('2026-08-10T00:00:00.000Z'),
    endsAt: new Date('2026-08-31T00:00:00.000Z'),
    reason: 'vacaciones',
  });
}

describe('FindAvailabilityOptionsUseCase', () => {
  let scheduleContext: jest.Mocked<Pick<ScheduleContextResolver, 'resolve'>>;
  let serviceRepository: jest.Mocked<Pick<ServiceRepository, 'findById'>>;
  let appointmentRepository: jest.Mocked<
    Pick<AppointmentRepository, 'findByProfessionalInRange'>
  >;
  let scheduleBlockRepository: jest.Mocked<
    Pick<ScheduleBlockRepository, 'findInRange'>
  >;
  let branchProfessionalRepository: jest.Mocked<
    Pick<BranchProfessionalRepository, 'findByProfessional'>
  >;
  let branchServiceRepository: jest.Mocked<
    Pick<BranchServiceRepository, 'findActiveByService'>
  >;
  let useCase: FindAvailabilityOptionsUseCase;

  beforeEach(() => {
    scheduleContext = {
      resolve: jest.fn((input: { serviceId: string; professionalId: string }) =>
        Promise.resolve(
          contextFor(input.professionalId === camila.id ? camila : valeria),
        ),
      ),
    };
    serviceRepository = {
      findById: jest.fn().mockResolvedValue(hidrafacial),
    };
    appointmentRepository = {
      findByProfessionalInRange: jest.fn().mockResolvedValue([]),
    };
    scheduleBlockRepository = { findInRange: jest.fn().mockResolvedValue([]) };
    branchProfessionalRepository = {
      findByProfessional: jest.fn().mockResolvedValue([]),
    };
    branchServiceRepository = {
      findActiveByService: jest.fn().mockResolvedValue([
        new BranchService({
          tenantId: 't1',
          branchId: branch.id,
          serviceId: hidrafacial.id,
          priceOverrideAmount: null,
          depositAmountOverrideAmount: null,
          depositQrId: null,
          isActive: true,
        }),
      ]),
    };

    useCase = new FindAvailabilityOptionsUseCase(
      scheduleContext as unknown as ScheduleContextResolver,
      serviceRepository as unknown as ServiceRepository,
      appointmentRepository as unknown as AppointmentRepository,
      scheduleBlockRepository as unknown as ScheduleBlockRepository,
      branchProfessionalRepository as unknown as BranchProfessionalRepository,
      branchServiceRepository as unknown as BranchServiceRepository,
    );
  });

  it('looks at every professional who performs the service when none was named', async () => {
    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      ...MONDAY,
    });

    expect(scheduleContext.resolve).toHaveBeenCalledTimes(2);
    expect(new Set(result.options.map((o) => o.professionalName))).toEqual(
      new Set(['Camila', 'Valeria']),
    );
  });

  // Without a preferred hour the old path dumped the first five of the 15-minute grid
  // (09:00, 09:15, 09:30…). The client asked for the day, not the first hour of it.
  it('spreads a handful of round offers across an open day', async () => {
    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      ...MONDAY,
    });

    expect(result.options).toHaveLength(4);
    const starts = result.options.map((option) =>
      option.startsAt.toISOString(),
    );
    expect(starts).not.toEqual([
      '2026-08-10T13:00:00.000Z',
      '2026-08-10T13:15:00.000Z',
      '2026-08-10T13:30:00.000Z',
      '2026-08-10T13:45:00.000Z',
    ]);
    expect(starts[0]).toBe('2026-08-10T13:00:00.000Z');
    expect(
      result.options.every((option) => {
        const minute = option.startsAt.getUTCMinutes();
        return minute === 0 || minute === 30;
      }),
    ).toBe(true);
    expect(result.availableDays).toHaveLength(1);
    expect(result.availableDays[0].windows).toEqual([
      {
        firstStart: new Date('2026-08-10T13:00:00.000Z'),
        lastStart: new Date('2026-08-10T21:00:00.000Z'),
      },
    ]);
  });

  it('answers about the exact moment the client asked for', async () => {
    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      preferredAt: new Date('2026-08-10T19:00:00.000Z'), // 15:00 local
      ...MONDAY,
    });

    expect(result.preferred?.available).toBe(true);
    expect(result.preferred?.professionalName).toBe('Camila');
  });

  it('says the slot is taken, and offers the closest hours around it', async () => {
    appointmentRepository.findByProfessionalInRange.mockResolvedValue([
      busy(camila.id, '2026-08-10T19:00:00.000Z'),
    ]);

    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      preferredAt: new Date('2026-08-10T19:00:00.000Z'),
      ...MONDAY,
    });

    expect(result.preferred?.reason).toBe(AvailabilityReason.TAKEN);
    // The hour before and the hour after: anything closer would run into the booked one.
    expect(
      new Set(result.options.slice(0, 2).map((o) => o.startsAt.toISOString())),
    ).toEqual(
      new Set(['2026-08-10T18:00:00.000Z', '2026-08-10T20:00:00.000Z']),
    );
    expect(result.options).toHaveLength(5);
  });

  // The calculator only ever sees the intersection of both agendas, so it reports both as
  // "closed". Which of the two it was is the difference between "no abrimos los domingos"
  // and "Camila no trabaja los miércoles".
  it('tells a closed branch apart from a professional on her day off', async () => {
    const wednesday = {
      from: new Date('2026-08-12T04:00:00.000Z'),
      to: new Date('2026-08-13T03:59:59.000Z'),
    };
    const sunday = {
      from: new Date('2026-08-09T04:00:00.000Z'),
      to: new Date('2026-08-10T03:59:59.000Z'),
    };

    const off = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      preferredAt: new Date('2026-08-12T19:00:00.000Z'),
      ...wednesday,
    });
    const closed = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      preferredAt: new Date('2026-08-09T19:00:00.000Z'),
      ...sunday,
    });

    expect(off.preferred?.reason).toBe(AvailabilityReason.PROFESSIONAL_OFF);
    expect(off.unavailableDays[0].reason).toBe(
      AvailabilityReason.PROFESSIONAL_OFF,
    );
    expect(closed.preferred?.reason).toBe(AvailabilityReason.BUSINESS_CLOSED);
    expect(closed.unavailableDays[0].reason).toBe(
      AvailabilityReason.BUSINESS_CLOSED,
    );
  });

  it('says when she works that weekday at another branch', async () => {
    branchProfessionalRepository.findByProfessional.mockResolvedValue([
      new BranchProfessional({
        tenantId: 't1',
        branchId: 'b-other',
        professionalId: camila.id,
        weeklyHours: { ...CAMILA_HOURS, wed: { start: '09:00', end: '18:00' } },
        isActive: true,
      }),
    ]);

    const wednesday = {
      from: new Date('2026-08-12T04:00:00.000Z'),
      to: new Date('2026-08-13T03:59:59.000Z'),
    };

    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      preferredAt: new Date('2026-08-12T19:00:00.000Z'),
      ...wednesday,
    });

    expect(result.preferred?.reason).toBe(
      AvailabilityReason.PROFESSIONAL_AT_OTHER_BRANCH,
    );
  });

  it('says when the treatment no longer fits before closing, and until when it does', async () => {
    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      preferredAt: new Date('2026-08-10T21:30:00.000Z'), // 17:30 local, closes at 18:00
      ...MONDAY,
    });

    expect(result.preferred?.reason).toBe(
      AvailabilityReason.SERVICE_DOES_NOT_FIT,
    );
    // 17:00 local is the last start whose hour still ends by closing.
    expect(result.preferred?.lastStartThatFits?.toISOString()).toBe(
      '2026-08-10T21:00:00.000Z',
    );
  });

  it('says how much notice the business needs instead of pretending the hour is busy', async () => {
    scheduleContext.resolve.mockResolvedValue({
      ...contextFor(camila),
      earliestStartAt: new Date('2026-08-10T22:00:00.000Z'),
    });

    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      preferredAt: new Date('2026-08-10T19:00:00.000Z'),
      ...MONDAY,
    });

    expect(result.preferred?.reason).toBe(AvailabilityReason.TOO_SOON);
    expect(result.preferred?.leadTimeHours).toBe(2);
  });

  it('falls back to the week ahead when the day the client asked for has nothing', async () => {
    const sunday = {
      from: new Date('2026-08-09T04:00:00.000Z'),
      to: new Date('2026-08-10T03:59:59.000Z'),
    };

    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      ...sunday,
    });

    expect(result.slots).toEqual([]);
    expect(result.options.length).toBeGreaterThan(0);
    // Spread still keeps the earliest free slot of the week ahead as one of the offers.
    expect(result.options[0].startsAt.toISOString()).toBe(
      '2026-08-10T13:00:00.000Z',
    );
    expect(result.nextAvailable).toBeNull();
  });

  // Three weeks of holiday used to come back as a bare "no hay espacio".
  it('keeps looking beyond the week when a professional is away, and says how far it is', async () => {
    scheduleBlockRepository.findInRange.mockResolvedValue([holiday(camila.id)]);

    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      ...MONDAY,
    });

    expect(result.options).toEqual([]);
    expect(result.nextAvailable?.professionalName).toBe('Camila');
    expect(result.nextAvailable?.startsAt.toISOString()).toBe(
      '2026-08-31T13:00:00.000Z',
    );
    expect(result.nextAvailable?.daysAway).toBe(21);
  });

  it('says when the service is outside the professional offer window that day', async () => {
    const mondayMorningOnly: WeeklyHours = {
      mon: { start: '09:00', end: '13:00' },
      tue: null,
      wed: null,
      thu: null,
      fri: null,
      sat: null,
      sun: null,
    };
    const base = contextFor(camila);
    scheduleContext.resolve.mockResolvedValue({
      ...base,
      serviceWindowHours: mondayMorningOnly,
      weeklyHours: intersectWeeklyHours(base.weeklyHours, mondayMorningOnly),
    });

    const tuesday = {
      from: new Date('2026-08-11T04:00:00.000Z'),
      to: new Date('2026-08-12T03:59:59.000Z'),
    };

    const result = await useCase.execute({
      serviceId: hidrafacial.id,
      professionalId: camila.id,
      preferredAt: new Date('2026-08-11T19:00:00.000Z'), // Tuesday 15:00 local
      ...tuesday,
    });

    expect(result.preferred?.reason).toBe(
      AvailabilityReason.SERVICE_OUTSIDE_OFFER_WINDOW,
    );
    expect(result.unavailableDays[0]?.reason).toBe(
      AvailabilityReason.SERVICE_OUTSIDE_OFFER_WINDOW,
    );
    expect(result.slots).toEqual([]);
  });

  // A missing table once reached the client as "esa profesional no realiza ese servicio".
  it('surfaces a broken schedule lookup instead of answering that nobody offers the service', async () => {
    const failure = new Error('relation "x" does not exist');
    scheduleContext.resolve.mockRejectedValue(failure);

    await expect(
      useCase.execute({ serviceId: hidrafacial.id, ...MONDAY }),
    ).rejects.toBe(failure);
  });

  it('answers that the pairing is not on offer when every professional is ruled out', async () => {
    scheduleContext.resolve.mockRejectedValue(new SlotUnavailableError());

    await expect(
      useCase.execute({ serviceId: hidrafacial.id, ...MONDAY }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);
  });
});
