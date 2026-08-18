import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import { Appointment } from '@domain/appointments/entities/appointment.entity';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '@domain/appointments/repositories/appointment.repository';
import {
  AvailabilityCalculator,
  DAY_KEYS,
  DayAvailability,
  DayOutcome,
} from '@domain/appointments/services/availability-calculator';
import {
  FreeWindow,
  mergeFreeWindows,
  pickSpreadSlots,
} from '@domain/appointments/services/slot-offering';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import {
  BRANCH_PROFESSIONAL_REPOSITORY,
  BranchProfessionalRepository,
} from '@domain/branches/repositories/branch-professional.repository';
import {
  BRANCH_SERVICE_REPOSITORY,
  BranchServiceRepository,
} from '@domain/branches/repositories/branch-service.repository';
import { ServiceNotOfferedAtBranchError } from '@domain/branches/exceptions/branch.exceptions';
import { DomainException } from '@domain/common/exceptions/domain.exception';
import { ScheduleBlock } from '@domain/schedule-blocks/entities/schedule-block.entity';
import {
  SCHEDULE_BLOCK_REPOSITORY,
  ScheduleBlockRepository,
} from '@domain/schedule-blocks/repositories/schedule-block.repository';
import { Service } from '@domain/services/entities/service.entity';
import {
  SERVICE_REPOSITORY,
  ServiceRepository,
} from '@domain/services/repositories/service.repository';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import {
  ScheduleContext,
  ScheduleContextResolver,
} from '../services/schedule-context-resolver.service';
import { resolveAppointmentDuration } from '../services/resolve-appointment-duration';

// Why a moment or a whole day has nothing on offer. Four different answers used to arrive
// as the same empty array, so the only sentence anyone could build was "no hay disponibilidad".
export enum AvailabilityReason {
  AVAILABLE = 'available',
  BUSINESS_CLOSED = 'business_closed',
  PROFESSIONAL_OFF = 'professional_off',
  PROFESSIONAL_AT_OTHER_BRANCH = 'professional_at_other_branch',
  PROFESSIONAL_BLOCKED = 'professional_blocked',
  SERVICE_NOT_OFFERED_AT_BRANCH = 'service_not_offered_at_branch',
  SERVICE_OUTSIDE_OFFER_WINDOW = 'service_outside_offer_window',
  BEFORE_OPENING = 'before_opening',
  SERVICE_DOES_NOT_FIT = 'service_does_not_fit',
  TOO_SOON = 'too_soon',
  TAKEN = 'taken',
  FULLY_BOOKED = 'fully_booked',
}

export interface FindAvailabilityOptionsInput {
  serviceId: string;
  professionalId?: string;
  branchId?: string;
  from: Date;
  to: Date;
  preferredAt?: Date;
  actor?: BookingActor;
  /**
   * Staff-only. When set, free slots are sized to this length instead of the
   * service catalog. The agent and the public page omit it.
   */
  durationMinutes?: number;
}

export interface SlotOption {
  startsAt: Date;
  professionalId: string;
  professionalName: string;
  // Set when availability was scanned across branches; omitted on single-branch answers.
  branchId?: string;
  branchName?: string;
}

export interface PreferredDiagnosis {
  at: Date;
  available: boolean;
  reason: AvailabilityReason;
  // Only for SERVICE_DOES_NOT_FIT: the latest start whose treatment still ends by closing.
  lastStartThatFits: Date | null;
  // Only for TOO_SOON.
  leadTimeHours: number | null;
  // Nearest free starts on the same day when the preferred moment is busy — so the agent
  // can say "ocupada, puedo hasta las 09:15 o desde las 10:45" instead of a dead end.
  lastStartBefore: Date | null;
  firstStartAfter: Date | null;
  // Only when the moment is free.
  professionalId: string | null;
  professionalName: string | null;
}

export interface UnavailableDay {
  date: Date;
  reason: AvailabilityReason;
}

export interface AvailableDay {
  date: Date;
  windows: FreeWindow[];
}

export interface NextAvailable extends SlotOption {
  daysAway: number;
}

export interface AvailabilityOptions {
  service: Service;
  timezone: string;
  preferred: PreferredDiagnosis | null;
  // Everything free inside the requested range, in order. The panel and the public page
  // list all of it; the agent reads `options` instead.
  slots: SlotOption[];
  options: SlotOption[];
  // Free stretches per day inside the requested range, so the agent can describe the day
  // without dumping every 15-minute slot.
  availableDays: AvailableDay[];
  unavailableDays: UnavailableDay[];
  nextAvailable: NextAvailable | null;
}

// With a preferred moment the agent needs a tight cluster around it; without one it needs
// a handful of offers that actually sample the day.
const MAX_OPTIONS = 5;
const MAX_SPREAD_OPTIONS = 4;
const ALTERNATIVE_WINDOW_DAYS = 7;
const MAX_LOOKAHEAD_DAYS = 90;

// When several professionals answer differently about the same moment, the most concrete
// answer wins: "está ocupado" tells the client more than "el negocio cierra".
const REASON_PRIORITY: AvailabilityReason[] = [
  AvailabilityReason.AVAILABLE,
  AvailabilityReason.TAKEN,
  AvailabilityReason.PROFESSIONAL_BLOCKED,
  AvailabilityReason.FULLY_BOOKED,
  AvailabilityReason.TOO_SOON,
  AvailabilityReason.SERVICE_DOES_NOT_FIT,
  AvailabilityReason.BEFORE_OPENING,
  AvailabilityReason.PROFESSIONAL_AT_OTHER_BRANCH,
  AvailabilityReason.SERVICE_OUTSIDE_OFFER_WINDOW,
  AvailabilityReason.SERVICE_NOT_OFFERED_AT_BRANCH,
  AvailabilityReason.PROFESSIONAL_OFF,
  AvailabilityReason.BUSINESS_CLOSED,
];

interface ProfessionalAvailability {
  context: ScheduleContext;
  days: DayAvailability[];
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  // Weekdays the professional works at another active branch assignment.
  otherBranchWeekdays: ReadonlySet<string>;
  /** Length used to size free slots for this scan (catalog or staff override). */
  durationMinutes: number;
}

// Answers "¿tenés mañana a las 19:00?" the way a receptionist would: yes or no, why not,
// and what there is instead. A single professional or every one who performs the service.
@Injectable()
export class FindAvailabilityOptionsUseCase {
  private readonly availability = new AvailabilityCalculator();

  constructor(
    private readonly scheduleContext: ScheduleContextResolver,
    @Inject(SERVICE_REPOSITORY)
    private readonly serviceRepository: ServiceRepository,
    @Inject(APPOINTMENT_REPOSITORY)
    private readonly appointmentRepository: AppointmentRepository,
    @Inject(SCHEDULE_BLOCK_REPOSITORY)
    private readonly scheduleBlockRepository: ScheduleBlockRepository,
    @Inject(BRANCH_PROFESSIONAL_REPOSITORY)
    private readonly branchProfessionalRepository: BranchProfessionalRepository,
    @Inject(BRANCH_SERVICE_REPOSITORY)
    private readonly branchServiceRepository: BranchServiceRepository,
  ) {}

  async execute(
    input: FindAvailabilityOptionsInput,
  ): Promise<AvailabilityOptions> {
    const service = await this.serviceRepository.findById(input.serviceId);
    if (!service) throw new ServiceNotFoundError(input.serviceId);

    const durationMinutes = resolveAppointmentDuration({
      serviceDurationMinutes: service.durationMinutes,
      actor: input.actor,
      durationMinutes: input.durationMinutes,
    });

    const contexts = await this.contextsFor(
      service,
      input.professionalId,
      input.branchId,
      input.actor,
    );
    const timezone = contexts[0].timezone;

    // One query per professional covers both the requested range and the week the
    // alternatives are drawn from, so the fallback costs no extra round trip.
    const searchTo = this.laterOf(
      input.to,
      this.addDays(input.from, ALTERNATIVE_WINDOW_DAYS, timezone),
    );
    const scanned = await Promise.all(
      contexts.map((context) =>
        this.scan(context, input.from, searchTo, durationMinutes),
      ),
    );

    const slots = this.optionsUntil(scanned, input.to).sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
    );
    const options = this.rankOptions(scanned, slots, input, timezone);

    return {
      service,
      timezone,
      preferred: input.preferredAt
        ? this.diagnose(scanned, input.preferredAt, timezone)
        : null,
      slots,
      options,
      availableDays: this.availableDays(slots, durationMinutes, timezone),
      unavailableDays: this.unavailableDays(scanned, input.to, timezone),
      nextAvailable: options.length
        ? null
        : await this.scanAhead(
            contexts,
            searchTo,
            input.from,
            timezone,
            durationMinutes,
          ),
    };
  }

  private async contextsFor(
    service: Service,
    professionalId: string | undefined,
    branchId: string | undefined,
    actor: BookingActor | undefined,
  ): Promise<ScheduleContext[]> {
    const branchIds = branchId
      ? [branchId]
      : (
          await this.branchServiceRepository.findActiveByService(service.id)
        ).map((offer) => offer.branchId);

    if (branchIds.length === 0) {
      throw new ServiceNotOfferedAtBranchError(service.id, 'any');
    }

    const professionalIds = professionalId
      ? [professionalId]
      : service.professionalIds;

    const resolved = await Promise.allSettled(
      branchIds.flatMap((candidateBranchId) =>
        professionalIds.map((id) =>
          this.scheduleContext.resolve({
            serviceId: service.id,
            professionalId: id,
            branchId: candidateBranchId,
            actor,
          }),
        ),
      ),
    );
    const contexts = resolved
      .filter(
        (result): result is PromiseFulfilledResult<ScheduleContext> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value);

    if (contexts.length === 0) {
      const rejections = resolved
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected',
        )
        .map((result) => result.reason);

      // A broken schedule lookup is not "the business does not offer this": reporting it as
      // one made the agent tell the client something false. Only a domain verdict may be
      // turned into an answer; anything else has to surface as the failure it is.
      const crash = rejections.find(
        (reason) => !(reason instanceof DomainException),
      );
      if (crash) throw crash;

      // An explicit professional must answer for herself: surface her failure, not a
      // silent empty search among the others.
      if (professionalId && rejections.length) throw rejections[0];

      const serviceNotOffered =
        rejections.length > 0 &&
        rejections.every(
          (reason) => reason instanceof ServiceNotOfferedAtBranchError,
        );
      if (serviceNotOffered) throw rejections[0];

      throw new SlotUnavailableError();
    }
    return contexts;
  }

  private async scan(
    context: ScheduleContext,
    from: Date,
    to: Date,
    durationMinutes: number,
  ): Promise<ProfessionalAvailability> {
    const [appointments, blocks, assignments] = await Promise.all([
      this.appointmentRepository.findByProfessionalInRange({
        professionalId: context.professional.id,
        from,
        to,
      }),
      this.scheduleBlockRepository.findInRange({
        from,
        to,
        professionalId: context.professional.id,
        branchId: context.branch.id,
      }),
      this.branchProfessionalRepository.findByProfessional(
        context.professional.id,
      ),
    ]);

    const otherBranchWeekdays = new Set<string>();
    for (const assignment of assignments) {
      if (!assignment.isActive || assignment.branchId === context.branch.id) {
        continue;
      }
      for (const dayKey of DAY_KEYS) {
        if (assignment.weeklyHours[dayKey]) otherBranchWeekdays.add(dayKey);
      }
    }

    return {
      context,
      appointments,
      blocks,
      otherBranchWeekdays,
      durationMinutes,
      days: this.availability.calculateByDay({
        weeklyHours: context.weeklyHours,
        durationMinutes,
        from,
        to,
        appointments,
        blocks,
        timezone: context.timezone,
        earliestStartAt: context.earliestStartAt,
      }),
    };
  }

  // Closest to what the client asked, same local day first. Without a preferred moment,
  // a handful of offers spread across the day — not the first five of the 15-minute grid.
  private rankOptions(
    scanned: ProfessionalAvailability[],
    withinRequestedRange: SlotOption[],
    input: FindAvailabilityOptionsInput,
    timezone: string,
  ): SlotOption[] {
    // Nothing in the range the client named, so the week ahead already in hand answers
    // instead of sending her away with a plain no.
    const pool = withinRequestedRange.length
      ? [...withinRequestedRange]
      : this.optionsUntil(scanned, null);
    const byStart = this.groupByStart(pool);
    const uniqueStarts = [...byStart.keys()]
      .sort((a, b) => a - b)
      .map((key) => byStart.get(key)![0]);
    const preferred = input.preferredAt;

    const ranked = preferred
      ? this.rankAroundPreferred(uniqueStarts, preferred, timezone)
      : pickSpreadSlots(uniqueStarts, MAX_SPREAD_OPTIONS, timezone);

    // Name a professional only after the times are chosen: rotating over the full grid
    // made every round hour land on the same person.
    return ranked.map((slot, index) => {
      const group = byStart.get(slot.startsAt.getTime()) ?? [slot];
      return group[index % group.length];
    });
  }

  private rankAroundPreferred(
    uniqueStarts: SlotOption[],
    preferred: Date,
    timezone: string,
  ): SlotOption[] {
    const preferredDay = this.localDay(preferred, timezone);
    return [...uniqueStarts]
      .sort((a, b) => {
        const sameDay =
          Number(this.localDay(a.startsAt, timezone) !== preferredDay) -
          Number(this.localDay(b.startsAt, timezone) !== preferredDay);
        if (sameDay !== 0) return sameDay;
        return (
          Math.abs(a.startsAt.getTime() - preferred.getTime()) -
          Math.abs(b.startsAt.getTime() - preferred.getTime())
        );
      })
      .slice(0, MAX_OPTIONS);
  }

  private groupByStart(slots: SlotOption[]): Map<number, SlotOption[]> {
    const byStart = new Map<number, SlotOption[]>();
    for (const slot of slots) {
      const key = slot.startsAt.getTime();
      const group = byStart.get(key);
      if (group) group.push(slot);
      else byStart.set(key, [slot]);
    }
    return byStart;
  }

  // Free stretches per local day, built from every professional's slots together so a
  // gap that only exists for one of them does not look like a closed morning.
  private availableDays(
    slots: SlotOption[],
    durationMinutes: number,
    timezone: string,
  ): AvailableDay[] {
    const byDay = new Map<string, SlotOption[]>();
    for (const slot of slots) {
      const key = this.localDay(slot.startsAt, timezone);
      const group = byDay.get(key);
      if (group) group.push(slot);
      else byDay.set(key, [slot]);
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, daySlots]) => {
        const uniqueStarts = [...this.groupByStart(daySlots).values()].map(
          (group) => group[0],
        );
        return {
          date: daySlots[0].startsAt,
          windows: mergeFreeWindows(uniqueStarts, durationMinutes),
        };
      });
  }

  private optionsUntil(
    scanned: ProfessionalAvailability[],
    to: Date | null,
  ): SlotOption[] {
    return scanned.flatMap(({ context, days }) =>
      days
        .flatMap((day) => day.slots)
        .filter((slot) => !to || slot.endsAt <= to)
        .map((slot) => ({
          startsAt: slot.startsAt,
          professionalId: context.professional.id,
          professionalName: context.professional.name,
          branchId: context.branch.id,
          branchName: context.branch.name,
        })),
    );
  }

  private diagnose(
    scanned: ProfessionalAvailability[],
    preferredAt: Date,
    timezone: string,
  ): PreferredDiagnosis {
    const verdicts = scanned.map((entry) =>
      this.diagnoseOne(entry, preferredAt, timezone),
    );

    return verdicts.sort(
      (a, b) =>
        REASON_PRIORITY.indexOf(a.reason) - REASON_PRIORITY.indexOf(b.reason),
    )[0];
  }

  private diagnoseOne(
    entry: ProfessionalAvailability,
    preferredAt: Date,
    timezone: string,
  ): PreferredDiagnosis {
    const { context } = entry;
    const neighbours = this.neighboursOnDay(entry, preferredAt, timezone);
    const base = {
      at: preferredAt,
      available: false,
      lastStartThatFits: null,
      leadTimeHours: null,
      lastStartBefore: neighbours.lastStartBefore,
      firstStartAfter: neighbours.firstStartAfter,
      professionalId: null,
      professionalName: null,
    };
    const local = DateTime.fromJSDate(preferredAt, { zone: timezone });
    const dayKey = DAY_KEYS[local.weekday - 1];

    if (!context.branch.weeklyHours[dayKey]) {
      return { ...base, reason: AvailabilityReason.BUSINESS_CLOSED };
    }
    if (!context.branchProfessional.weeklyHours[dayKey]) {
      return {
        ...base,
        reason: entry.otherBranchWeekdays.has(dayKey)
          ? AvailabilityReason.PROFESSIONAL_AT_OTHER_BRANCH
          : AvailabilityReason.PROFESSIONAL_OFF,
      };
    }

    const hours = context.weeklyHours[dayKey];
    if (!hours) {
      return {
        ...base,
        reason: context.serviceWindowHours
          ? AvailabilityReason.SERVICE_OUTSIDE_OFFER_WINDOW
          : AvailabilityReason.PROFESSIONAL_OFF,
      };
    }

    const opensAt = this.atTime(local, hours.start);
    if (local < opensAt) {
      return { ...base, reason: AvailabilityReason.BEFORE_OPENING };
    }

    const endsAt = local.plus({ minutes: entry.durationMinutes });
    if (endsAt > this.atTime(local, hours.end)) {
      return {
        ...base,
        reason: AvailabilityReason.SERVICE_DOES_NOT_FIT,
        lastStartThatFits:
          this.dayOf(entry, preferredAt, timezone)?.lastStartThatFits ?? null,
      };
    }

    if (preferredAt < context.earliestStartAt) {
      return {
        ...base,
        reason: AvailabilityReason.TOO_SOON,
        leadTimeHours: context.config.bookingPolicy.minLeadTimeHours,
      };
    }

    // The exact interval the client asked for, not the nearest slot on the grid: someone
    // who says "a las 19:15" deserves an answer about 19:15.
    const conflict = this.availability.slotConflict({
      startsAt: preferredAt,
      endsAt: endsAt.toJSDate(),
      appointments: entry.appointments,
      blocks: entry.blocks,
    });

    if (!conflict) {
      return {
        ...base,
        available: true,
        reason: AvailabilityReason.AVAILABLE,
        lastStartBefore: null,
        firstStartAfter: null,
        professionalId: context.professional.id,
        professionalName: context.professional.name,
      };
    }

    return {
      ...base,
      reason:
        conflict === 'block'
          ? AvailabilityReason.PROFESSIONAL_BLOCKED
          : AvailabilityReason.TAKEN,
    };
  }

  // Free starts on the same local day, either side of the preferred moment.
  private neighboursOnDay(
    entry: ProfessionalAvailability,
    preferredAt: Date,
    timezone: string,
  ): { lastStartBefore: Date | null; firstStartAfter: Date | null } {
    const day = this.dayOf(entry, preferredAt, timezone);
    if (!day || day.slots.length === 0) {
      return { lastStartBefore: null, firstStartAfter: null };
    }

    let lastStartBefore: Date | null = null;
    let firstStartAfter: Date | null = null;
    for (const slot of day.slots) {
      if (slot.startsAt.getTime() < preferredAt.getTime()) {
        lastStartBefore = slot.startsAt;
      } else if (
        slot.startsAt.getTime() > preferredAt.getTime() &&
        firstStartAfter === null
      ) {
        firstStartAfter = slot.startsAt;
      }
    }
    return { lastStartBefore, firstStartAfter };
  }

  // Days inside the requested range where nobody had anything, each with the reason that
  // best explains it. A closed Sunday and a booked-out Monday are different sentences.
  private unavailableDays(
    scanned: ProfessionalAvailability[],
    to: Date,
    timezone: string,
  ): UnavailableDay[] {
    const days = new Map<string, UnavailableDay>();

    for (const entry of scanned) {
      for (const day of entry.days) {
        if (day.date > to) continue;

        const key = this.localDay(day.date, timezone);
        const reason = this.dayReason(entry, day, timezone);
        const previous = days.get(key);
        if (
          !previous ||
          REASON_PRIORITY.indexOf(reason) <
            REASON_PRIORITY.indexOf(previous.reason)
        ) {
          days.set(key, { date: day.date, reason });
        }
      }
    }

    return [...days.values()]
      .filter((day) => day.reason !== AvailabilityReason.AVAILABLE)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private dayReason(
    entry: ProfessionalAvailability,
    day: DayAvailability,
    timezone: string,
  ): AvailabilityReason {
    if (day.outcome === DayOutcome.AVAILABLE)
      return AvailabilityReason.AVAILABLE;
    if (day.outcome === DayOutcome.FULLY_BOOKED)
      return AvailabilityReason.FULLY_BOOKED;
    if (day.outcome === DayOutcome.TOO_SOON) return AvailabilityReason.TOO_SOON;
    if (day.outcome === DayOutcome.SERVICE_DOES_NOT_FIT)
      return AvailabilityReason.SERVICE_DOES_NOT_FIT;

    // The calculator only sees the intersection, so it cannot tell a closed branch from
    // a professional's day off. The context holds both agendas.
    const dayKey =
      DAY_KEYS[DateTime.fromJSDate(day.date, { zone: timezone }).weekday - 1];
    if (!entry.context.branch.weeklyHours[dayKey]) {
      return AvailabilityReason.BUSINESS_CLOSED;
    }
    if (!entry.context.branchProfessional.weeklyHours[dayKey]) {
      return entry.otherBranchWeekdays.has(dayKey)
        ? AvailabilityReason.PROFESSIONAL_AT_OTHER_BRANCH
        : AvailabilityReason.PROFESSIONAL_OFF;
    }
    if (entry.context.serviceWindowHours) {
      return AvailabilityReason.SERVICE_OUTSIDE_OFFER_WINDOW;
    }
    return AvailabilityReason.PROFESSIONAL_OFF;
  }

  // Only runs when the week ahead came back empty, which is the professional-on-holiday
  // case. Walks forward in one query per professional until the first real opening.
  private async scanAhead(
    contexts: ScheduleContext[],
    from: Date,
    countingFrom: Date,
    timezone: string,
    durationMinutes: number,
  ): Promise<NextAvailable | null> {
    const to = this.addDays(countingFrom, MAX_LOOKAHEAD_DAYS, timezone);
    if (to <= from) return null;

    const scanned = await Promise.all(
      contexts.map((context) => this.scan(context, from, to, durationMinutes)),
    );
    const [earliest] = this.optionsUntil(scanned, null).sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
    );
    if (!earliest) return null;

    // Counted from what the client asked for, so the agent can say "recién en tres
    // semanas" instead of reading out a loose date.
    return {
      ...earliest,
      daysAway: Math.max(
        0,
        Math.round(
          DateTime.fromJSDate(earliest.startsAt, { zone: timezone })
            .startOf('day')
            .diff(
              DateTime.fromJSDate(countingFrom, { zone: timezone }).startOf(
                'day',
              ),
              'days',
            ).days,
        ),
      ),
    };
  }

  private dayOf(
    entry: ProfessionalAvailability,
    at: Date,
    timezone: string,
  ): DayAvailability | undefined {
    const key = this.localDay(at, timezone);
    return entry.days.find((day) => this.localDay(day.date, timezone) === key);
  }

  private atTime(day: DateTime, hm: string): DateTime {
    const [hour, minute] = hm.split(':').map(Number);
    return day.set({ hour, minute, second: 0, millisecond: 0 });
  }

  private localDay(date: Date, timezone: string): string {
    return DateTime.fromJSDate(date, { zone: timezone }).toISODate() ?? '';
  }

  private addDays(date: Date, days: number, timezone: string): Date {
    return DateTime.fromJSDate(date, { zone: timezone })
      .plus({ days })
      .toJSDate();
  }

  private laterOf(a: Date, b: Date): Date {
    return a > b ? a : b;
  }
}
