import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import {
  AvailabilityOptions,
  AvailabilityReason,
  FindAvailabilityOptionsUseCase,
  PreferredDiagnosis,
  SlotOption,
} from '@application/appointments/use-cases/find-availability-options.use-case';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import {
  BranchNotFoundError,
  BranchRequiredError,
  ProfessionalDoesNotPerformServiceError,
  ProfessionalNotAtBranchError,
  ServiceNotOfferedAtBranchError,
} from '@domain/branches/exceptions/branch.exceptions';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import {
  AvailabilityDayPart,
  AvailabilitySegment,
  buildAvailabilitySegments,
  filterSlotsByDayPart,
  summarizeAvailabilityDays,
} from './availability-presentation';
import { branchRequiredWarning } from './branch-required.warning';
import { clockLabel } from './clock-label';
import {
  asObject,
  optionalIsoDate,
  optionalString,
  optionalUuid,
  requiredIsoDate,
  requiredUuid,
} from './tool-input';

const MAX_RANGE_DAYS = 14;

const DAY_PART_LABEL: Record<AvailabilityDayPart, string> = {
  [AvailabilityDayPart.MORNING]: 'mañana',
  [AvailabilityDayPart.AFTERNOON]: 'tarde',
  [AvailabilityDayPart.EVENING]: 'noche',
};

// Every AvailabilityReason must have a Spanish sentence. A missing key is a TypeScript
// error — never a silent `default: null` that made the model invent "no está disponible".
const REASON_DETAIL: Record<
  AvailabilityReason,
  (preferred: PreferredDiagnosis, timezone: string) => string | null
> = {
  [AvailabilityReason.AVAILABLE]: () => null,
  [AvailabilityReason.BUSINESS_CLOSED]: () => 'El negocio no atiende ese día.',
  [AvailabilityReason.PROFESSIONAL_OFF]: () =>
    'La profesional no trabaja ese día.',
  [AvailabilityReason.PROFESSIONAL_AT_OTHER_BRANCH]: () =>
    'Esa profesional atiende en otra sucursal ese día.',
  [AvailabilityReason.PROFESSIONAL_BLOCKED]: () =>
    'Esa profesional no está disponible ese día.',
  [AvailabilityReason.SERVICE_NOT_OFFERED_AT_BRANCH]: () =>
    'Ese servicio no se ofrece en esta sucursal.',
  [AvailabilityReason.SERVICE_OUTSIDE_OFFER_WINDOW]: () =>
    'Esa profesional no ofrece ese servicio en ese horario.',
  [AvailabilityReason.BEFORE_OPENING]: () => 'Es antes de la hora de apertura.',
  [AvailabilityReason.SERVICE_DOES_NOT_FIT]: (preferred, timezone) =>
    preferred.lastStartThatFits
      ? `Ese tratamiento ya no entra antes del cierre. La última hora de inicio posible ese día es ${clockLabel(preferred.lastStartThatFits, timezone)}.`
      : 'Ese tratamiento no entra en el horario de ese día.',
  [AvailabilityReason.TOO_SOON]: (preferred) =>
    `El negocio necesita ${preferred.leadTimeHours} horas de anticipación para reservar.`,
  [AvailabilityReason.TAKEN]: (preferred, timezone) =>
    takenDetail(preferred, timezone),
  [AvailabilityReason.FULLY_BOOKED]: () => 'Ese día ya está completo.',
};

function takenDetail(preferred: PreferredDiagnosis, timezone: string): string {
  const parts = ['Esa hora ya está ocupada.'];
  if (preferred.lastStartBefore) {
    parts.push(
      `Podés empezar hasta las ${clockLabel(preferred.lastStartBefore, timezone)}.`,
    );
  }
  if (preferred.firstStartAfter) {
    parts.push(
      `La próxima libre es a las ${clockLabel(preferred.firstStartAfter, timezone)}.`,
    );
  }
  return parts.join(' ');
}

// Day-level reasons share the same sentences, without the preferred-hour extras.
const DAY_REASON_DETAIL: Record<AvailabilityReason, string> = {
  [AvailabilityReason.AVAILABLE]: 'Hay horarios libres.',
  [AvailabilityReason.BUSINESS_CLOSED]: 'El negocio no atiende ese día.',
  [AvailabilityReason.PROFESSIONAL_OFF]: 'La profesional no trabaja ese día.',
  [AvailabilityReason.PROFESSIONAL_AT_OTHER_BRANCH]:
    'Esa profesional atiende en otra sucursal ese día.',
  [AvailabilityReason.PROFESSIONAL_BLOCKED]:
    'Esa profesional no está disponible ese día.',
  [AvailabilityReason.SERVICE_NOT_OFFERED_AT_BRANCH]:
    'Ese servicio no se ofrece en esta sucursal.',
  [AvailabilityReason.SERVICE_OUTSIDE_OFFER_WINDOW]:
    'Esa profesional no ofrece ese servicio en ese horario.',
  [AvailabilityReason.BEFORE_OPENING]: 'Es antes de la hora de apertura.',
  [AvailabilityReason.SERVICE_DOES_NOT_FIT]:
    'Ese tratamiento no entra en el horario de ese día.',
  [AvailabilityReason.TOO_SOON]:
    'Todavía no se puede reservar ese día: hace falta más anticipación.',
  [AvailabilityReason.TAKEN]: 'Ese día ya tiene horarios ocupados.',
  [AvailabilityReason.FULLY_BOOKED]: 'Ese día ya está completo.',
};

@Injectable()
export class FindAvailabilityAgentTool implements AgentTool {
  readonly definition = {
    name: 'find_availability',
    description:
      'Busca disponibilidad real para un servicio con detalle progresivo: días y franjas para búsquedas amplias, rangos u horas para un día, y diagnóstico para una hora exacta. Sin sucursal fijada, busca en todas. Única fuente de horarios: solo podés nombrar los que devuelve.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['serviceId', 'from', 'to'],
      properties: {
        serviceId: { type: 'string', description: 'UUID del servicio' },
        professionalId: {
          type: 'string',
          description: 'UUID del profesional; omití para buscar en todas',
        },
        preferredAt: {
          type: 'string',
          description:
            'Hora exacta pedida por la clienta, ISO 8601 con offset del negocio',
        },
        dayPart: {
          type: 'string',
          enum: Object.values(AvailabilityDayPart),
          description:
            'Franja pedida: morning antes de 12:00, afternoon de 12:00 a 17:59, evening desde 18:00',
        },
        from: {
          type: 'string',
          description: 'Inicio del rango, ISO 8601 con offset del negocio',
        },
        to: {
          type: 'string',
          description:
            'Fin del rango, ISO 8601; máximo 14 días después de from',
        },
      },
    },
  };

  constructor(private readonly findOptions: FindAvailabilityOptionsUseCase) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const values = asObject(input);
    const from = requiredIsoDate(values, 'from');
    const to = requiredIsoDate(values, 'to');
    const rangeMs = Date.parse(to) - Date.parse(from);
    if (rangeMs <= 0 || rangeMs > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return {
        status: 'warning',
        summary: `El rango pedido no sirve: "from" tiene que ser anterior a "to" y abarcar como mucho ${MAX_RANGE_DAYS} días.`,
        nextActions: ['Pedir de nuevo con un rango más corto.'],
      };
    }

    const preferredAt = optionalIsoDate(values, 'preferredAt');
    const professionalId = optionalUuid(values, 'professionalId');
    const dayPart = this.dayPart(optionalString(values, 'dayPart'));

    let result: AvailabilityOptions;
    try {
      result = await this.findOptions.execute({
        serviceId: requiredUuid(values, 'serviceId'),
        professionalId,
        branchId: context.branchId ?? undefined,
        preferredAt: preferredAt ? new Date(preferredAt) : undefined,
        from: new Date(from),
        to: new Date(to),
        actor: BookingActor.CLIENT,
      });
    } catch (error) {
      if (error instanceof BranchRequiredError) {
        return branchRequiredWarning();
      }
      // A combination that cannot be booked is an answer, not a failure: told apart from a
      // crash, the agent can explain it instead of improvising its own schedule.
      const reason = this.explain(error, !!professionalId);
      if (!reason) throw error;
      return {
        status: 'warning',
        summary: reason,
        nextActions: [
          professionalId
            ? 'Decirlo con honestidad y ofrecer otra profesional u otro servicio.'
            : 'Decirlo con honestidad y ofrecer otro servicio.',
        ],
      };
    }

    const timezone = context.timezone;
    if (result.preferred) {
      return this.preferredResult(result, timezone);
    }

    const matchingSlots = filterSlotsByDayPart(result.slots, dayPart, timezone);
    if (this.isSingleLocalDay(new Date(from), new Date(to), timezone)) {
      return this.dayScheduleResult(
        result,
        matchingSlots,
        dayPart,
        new Date(from),
        timezone,
      );
    }

    return this.dayChoiceResult(result, matchingSlots, dayPart, timezone);
  }

  private preferredResult(
    result: AvailabilityOptions,
    timezone: string,
  ): AgentToolResult {
    const sameDay =
      result.options.length > 0 &&
      result.options.every(
        (option) =>
          this.localDay(option.startsAt, timezone) ===
          this.localDay(result.options[0].startsAt, timezone),
      );
    return {
      status: 'success',
      summary: this.summarize(result),
      offerableTimes: this.preferredOfferableTimes(result, timezone),
      data: {
        mode: 'resolve_exact_time',
        preferred: result.preferred
          ? {
              label: this.label(result.preferred.at, timezone),
              available: result.preferred.available,
              reason: result.preferred.reason,
              detail: this.detail(result.preferred, timezone),
              professionalName: result.preferred.professionalName,
              lastStartBefore: result.preferred.lastStartBefore
                ? this.timeLabel(result.preferred.lastStartBefore, timezone)
                : null,
              firstStartAfter: result.preferred.firstStartAfter
                ? this.timeLabel(result.preferred.firstStartAfter, timezone)
                : null,
            }
          : null,
        dayLabel: sameDay
          ? this.dayLabel(result.options[0].startsAt, timezone)
          : null,
        options: result.options.map((option) => ({
          startsAt: option.startsAt.toISOString(),
          label: sameDay
            ? this.timeLabel(option.startsAt, timezone)
            : this.label(option.startsAt, timezone),
          professionalId: option.professionalId,
          professionalName: option.professionalName,
          branchId: option.branchId,
          branchName: option.branchName,
        })),
        unavailableDays: result.unavailableDays.map((day) => ({
          label: this.dayLabel(day.date, timezone),
          reason: day.reason,
          detail: DAY_REASON_DETAIL[day.reason],
        })),
        nextAvailable: result.nextAvailable
          ? {
              startsAt: result.nextAvailable.startsAt.toISOString(),
              label: this.label(result.nextAvailable.startsAt, timezone),
              professionalId: result.nextAvailable.professionalId,
              professionalName: result.nextAvailable.professionalName,
              branchId: result.nextAvailable.branchId,
              branchName: result.nextAvailable.branchName,
              daysAway: result.nextAvailable.daysAway,
            }
          : null,
        clientChoosesProfessional: result.service.clientChoosesProfessional,
      },
      nextActions: this.nextActions(result),
    };
  }

  private dayChoiceResult(
    result: AvailabilityOptions,
    slots: readonly SlotOption[],
    dayPart: AvailabilityDayPart | undefined,
    timezone: string,
  ): AgentToolResult {
    const fallbackSlots = filterSlotsByDayPart(
      result.options,
      dayPart,
      timezone,
    );
    const days = this.daySummaries(
      slots.length ? slots : fallbackSlots,
      timezone,
    );
    const nextAvailable = days.length
      ? null
      : this.nextAvailableData(result, timezone);

    return {
      status: 'success',
      summary: days.length
        ? `${days.length} día(s) con disponibilidad${dayPart ? ` en la ${DAY_PART_LABEL[dayPart]}` : ''}.`
        : dayPart
          ? `No hay horarios en la ${DAY_PART_LABEL[dayPart]} dentro del rango pedido.`
          : this.summarize(result),
      offerableTimes: nextAvailable ? [nextAvailable.label] : [],
      data: {
        mode: 'choose_day_and_period',
        requestedPeriod: dayPart ? DAY_PART_LABEL[dayPart] : null,
        days,
        unavailableDays: result.unavailableDays.map((day) => ({
          label: this.dayLabel(day.date, timezone),
          reason: day.reason,
          detail: DAY_REASON_DETAIL[day.reason],
        })),
        nextAvailable,
        clientChoosesProfessional: result.service.clientChoosesProfessional,
      },
      nextActions: this.withProfessionalGuidance(
        days.length
          ? [
              dayPart
                ? 'Mostrá solo los días y preguntá cuál prefiere; no nombres horas todavía.'
                : 'Mostrá los días con sus franjas y preguntá qué día y franja prefiere; no nombres horas todavía.',
            ]
          : [
              nextAvailable
                ? `No hay disponibilidad en el rango: ofrecé nextAvailable, que está en ${nextAvailable.daysAway} días.`
                : 'No hay disponibilidad cercana: decilo y derivá.',
            ],
        result,
      ),
    };
  }

  private dayScheduleResult(
    result: AvailabilityOptions,
    slots: readonly SlotOption[],
    dayPart: AvailabilityDayPart | undefined,
    requestedAt: Date,
    timezone: string,
  ): AgentToolResult {
    const segments = buildAvailabilitySegments(slots);
    const segmentData = segments.map((segment) =>
      this.segmentData(segment, timezone),
    );
    const otherPeriods = summarizeAvailabilityDays(
      result.slots,
      timezone,
    ).flatMap((day) => day.dayParts);
    const alternativeDays =
      segments.length === 0
        ? this.daySummaries(
            filterSlotsByDayPart(result.options, dayPart, timezone),
            timezone,
          ).filter((day) => day.label !== this.dayLabel(requestedAt, timezone))
        : [];
    const nextAvailable =
      segments.length === 0 && !dayPart
        ? this.nextAvailableData(result, timezone)
        : null;

    return {
      status: 'success',
      summary: segments.length
        ? `${segments.length} bloque(s) de horarios libres el ${this.dayLabel(requestedAt, timezone)}.`
        : dayPart
          ? `No hay horarios en la ${DAY_PART_LABEL[dayPart]} ese día.`
          : this.summarize(result),
      offerableTimes: [
        ...this.segmentOfferableTimes(segments, timezone),
        ...(nextAvailable ? [nextAvailable.label] : []),
      ],
      data: {
        mode: 'show_day_schedule',
        dayLabel: this.dayLabel(requestedAt, timezone),
        requestedPeriod: dayPart ? DAY_PART_LABEL[dayPart] : null,
        segments: segmentData,
        availableOtherPeriods:
          segments.length === 0 && dayPart
            ? [
                ...new Set(
                  otherPeriods
                    .filter((part) => part !== dayPart)
                    .map((part) => DAY_PART_LABEL[part]),
                ),
              ]
            : [],
        alternativeDays,
        unavailableDays: result.unavailableDays.map((day) => ({
          label: this.dayLabel(day.date, timezone),
          reason: day.reason,
          detail: DAY_REASON_DETAIL[day.reason],
        })),
        nextAvailable,
        clientChoosesProfessional: result.service.clientChoosesProfessional,
      },
      nextActions: this.withProfessionalGuidance(
        segments.length
          ? [
              'Mostrá todos los segments tal cual: los rangos como rangos y las horas aisladas como horas. No agregues options.',
              'Cuando la clienta elija una hora, volvé a consultar con preferredAt antes de reservar.',
            ]
          : dayPart && otherPeriods.length
            ? [
                'Decí que esa franja no tiene lugar y ofrecé las otras franjas del día.',
              ]
            : alternativeDays.length
              ? [
                  'Ese día no tiene lugar: ofrecé los días y franjas de alternativeDays sin nombrar horas.',
                ]
              : [
                  nextAvailable
                    ? `Ese día no tiene lugar: ofrecé nextAvailable, que está en ${nextAvailable.daysAway} días.`
                    : 'Ese día no tiene lugar: pedí otra fecha.',
                ],
        result,
      ),
    };
  }

  private daySummaries(
    slots: readonly SlotOption[],
    timezone: string,
  ): { label: string; periods: string[] }[] {
    return summarizeAvailabilityDays(slots, timezone).map((day) => ({
      label: this.dayLabel(day.date, timezone),
      periods: day.dayParts.map((part) => DAY_PART_LABEL[part]),
    }));
  }

  private preferredOfferableTimes(
    result: AvailabilityOptions,
    timezone: string,
  ): string[] {
    return [
      ...result.options.map((option) =>
        this.timeLabel(option.startsAt, timezone),
      ),
      ...(result.preferred
        ? [this.timeLabel(result.preferred.at, timezone)]
        : []),
      ...(result.preferred?.lastStartThatFits
        ? [this.timeLabel(result.preferred.lastStartThatFits, timezone)]
        : []),
      ...(result.preferred?.lastStartBefore
        ? [this.timeLabel(result.preferred.lastStartBefore, timezone)]
        : []),
      ...(result.preferred?.firstStartAfter
        ? [this.timeLabel(result.preferred.firstStartAfter, timezone)]
        : []),
    ];
  }

  private segmentData(
    segment: AvailabilitySegment,
    timezone: string,
  ): Record<string, unknown> {
    if (segment.kind === 'range') {
      return {
        kind: segment.kind,
        label: `se puede empezar entre ${this.timeLabel(segment.firstStart.startsAt, timezone)} y ${this.timeLabel(segment.lastStart.startsAt, timezone)}`,
        from: this.timeLabel(segment.firstStart.startsAt, timezone),
        to: this.timeLabel(segment.lastStart.startsAt, timezone),
      };
    }

    return {
      kind: segment.kind,
      times: segment.slots.map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        label: this.timeLabel(slot.startsAt, timezone),
        professionalId: slot.professionalId,
        professionalName: slot.professionalName,
        branchId: slot.branchId,
        branchName: slot.branchName,
      })),
    };
  }

  private segmentOfferableTimes(
    segments: readonly AvailabilitySegment[],
    timezone: string,
  ): string[] {
    return segments.flatMap((segment) =>
      segment.kind === 'range'
        ? [
            this.timeLabel(segment.firstStart.startsAt, timezone),
            this.timeLabel(segment.lastStart.startsAt, timezone),
          ]
        : segment.slots.map((slot) => this.timeLabel(slot.startsAt, timezone)),
    );
  }

  private nextAvailableData(
    result: AvailabilityOptions,
    timezone: string,
  ): {
    startsAt: string;
    label: string;
    professionalId: string;
    professionalName: string;
    branchId?: string;
    branchName?: string;
    daysAway: number;
  } | null {
    return result.nextAvailable
      ? {
          startsAt: result.nextAvailable.startsAt.toISOString(),
          label: this.label(result.nextAvailable.startsAt, timezone),
          professionalId: result.nextAvailable.professionalId,
          professionalName: result.nextAvailable.professionalName,
          branchId: result.nextAvailable.branchId,
          branchName: result.nextAvailable.branchName,
          daysAway: result.nextAvailable.daysAway,
        }
      : null;
  }

  private summarize(result: AvailabilityOptions): string {
    if (result.preferred?.available) {
      return `La hora pedida está libre. ${result.options.length} alternativas cercanas.`;
    }
    if (result.preferred && result.options.length) {
      return `La hora pedida no está disponible. ${result.options.length} alternativas cercanas.`;
    }
    if (result.options.length) {
      const windows = result.availableDays.flatMap((day) => day.windows).length;
      return windows
        ? `${result.availableDays.length} día(s) con franjas libres y ${result.options.length} horarios concretos para ofrecer.`
        : `${result.options.length} horarios disponibles.`;
    }
    return result.nextAvailable
      ? `Sin horarios en el rango pedido. El próximo hueco real es en ${result.nextAvailable.daysAway} días.`
      : 'Sin horarios en el rango pedido ni en los próximos 90 días.';
  }

  private nextActions(result: AvailabilityOptions): string[] {
    const actions: string[] = [];

    if (result.preferred && !result.preferred.available) {
      actions.push(
        'Explicá preferred.reason/detail y ofrecé lastStartBefore/firstStartAfter si vienen.',
      );
    } else if (!result.preferred && result.availableDays.length) {
      actions.push(
        'Usá availableDays para la franja y options para horarios concretos; no desgloses franjas.',
      );
    } else if (result.options.length) {
      actions.push('Ofrecé solo options; no inventes horarios.');
    } else if (result.nextAvailable) {
      actions.push(
        `Sin hueco cerca: el próximo es ${result.nextAvailable.professionalName} en ${result.nextAvailable.daysAway} días.`,
      );
    } else {
      actions.push('Sin horarios en 90 días: decilo y derivá.');
    }
    if (!result.service.clientChoosesProfessional) {
      actions.push('No preguntar profesional; usá la de la opción.');
    }
    const branchNames = [
      ...new Set(
        result.options
          .map((option) => option.branchName)
          .filter((name): name is string => !!name),
      ),
    ];
    if (branchNames.length > 1) {
      actions.push('Nombrá la sucursal de cada horario.');
    } else if (branchNames.length === 1) {
      actions.push(`Horarios en ${branchNames[0]}.`);
    }

    return actions;
  }

  private withProfessionalGuidance(
    actions: string[],
    result: AvailabilityOptions,
  ): string[] {
    return result.service.clientChoosesProfessional
      ? actions
      : [
          ...actions,
          'No preguntar profesional; se define al verificar la hora.',
        ];
  }

  private detail(
    preferred: PreferredDiagnosis,
    timezone: string,
  ): string | null {
    return REASON_DETAIL[preferred.reason](preferred, timezone);
  }

  // Nobody named a professional when `professionalNamed` is false, so a sentence about
  // "esa profesional" would invent a request the client never made.
  private explain(error: unknown, professionalNamed: boolean): string | null {
    if (error instanceof ProfessionalDoesNotPerformServiceError) {
      return professionalNamed
        ? 'Esa profesional no realiza ese servicio.'
        : 'Ahora mismo no hay ninguna profesional activa que realice ese servicio.';
    }
    if (error instanceof SlotUnavailableError) {
      return professionalNamed
        ? 'Esa profesional no realiza ese servicio, o alguno de los dos está inactivo.'
        : 'Ahora mismo no hay ninguna profesional activa que realice ese servicio.';
    }
    if (error instanceof ProfessionalNotFoundError) {
      return 'No existe esa profesional.';
    }
    if (error instanceof ServiceNotFoundError) {
      return 'No existe ese servicio.';
    }
    if (error instanceof BranchNotFoundError) {
      return 'La sucursal de esta conversación ya no está disponible.';
    }
    if (error instanceof ServiceNotOfferedAtBranchError) {
      return 'Ese servicio no se ofrece en esta sucursal.';
    }
    if (error instanceof ProfessionalNotAtBranchError) {
      return 'Esa profesional no atiende en esta sucursal.';
    }
    return null;
  }

  private label(at: Date, timezone: string): string {
    return this.local(at, timezone).toFormat("cccc d 'de' LLLL, HH:mm");
  }

  private dayLabel(at: Date, timezone: string): string {
    return this.local(at, timezone).toFormat("cccc d 'de' LLLL");
  }

  private timeLabel(at: Date, timezone: string): string {
    return clockLabel(at, timezone);
  }

  private dayPart(value: string | undefined): AvailabilityDayPart | undefined {
    if (value === undefined) return undefined;
    if (
      !Object.values(AvailabilityDayPart).includes(value as AvailabilityDayPart)
    ) {
      throw new Error('dayPart must be morning, afternoon, or evening');
    }
    return value as AvailabilityDayPart;
  }

  private isSingleLocalDay(from: Date, to: Date, timezone: string): boolean {
    const finalInstant = new Date(Math.max(from.getTime(), to.getTime() - 1));
    return (
      this.localDay(from, timezone) === this.localDay(finalInstant, timezone)
    );
  }

  private localDay(at: Date, timezone: string): string {
    return this.local(at, timezone).toISODate() ?? '';
  }

  private local(at: Date, timezone: string): DateTime {
    return DateTime.fromJSDate(at).setZone(timezone).setLocale('es');
  }
}
