import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import {
  AvailabilityOptions,
  AvailabilityReason,
  FindAvailabilityOptionsUseCase,
  PreferredDiagnosis,
} from '@application/appointments/use-cases/find-availability-options.use-case';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
import { FreeWindow } from '@domain/appointments/services/slot-offering';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import {
  BranchNotFoundError,
  BranchRequiredError,
  ProfessionalNotAtBranchError,
  ServiceNotOfferedAtBranchError,
} from '@domain/branches/exceptions/branch.exceptions';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { branchRequiredWarning } from './branch-required.warning';
import { clockLabel } from './clock-label';
import {
  asObject,
  optionalIsoDate,
  optionalUuid,
  requiredIsoDate,
  requiredUuid,
} from './tool-input';

const MAX_RANGE_DAYS = 14;

@Injectable()
export class FindAvailabilityAgentTool implements AgentTool {
  readonly definition = {
    name: 'find_availability',
    description:
      'Busca horarios reales para un servicio en la sucursal de la conversación. Es la única fuente de horarios: los únicos que podés nombrar son los que devuelve. Dice si la hora pedida está libre y por qué no, unas pocas alternativas concretas para ofrecer, las franjas libres de cada día con su última hora de inicio, los días sin atención y, si no hay nada, el próximo hueco real.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['serviceId', 'from', 'to'],
      properties: {
        serviceId: { type: 'string', description: 'UUID del servicio' },
        professionalId: {
          type: 'string',
          description:
            'UUID del profesional. Omitilo para buscar en todas las que hacen el servicio',
        },
        preferredAt: {
          type: 'string',
          description:
            'La hora exacta que pidió la clienta, ISO 8601 con offset del negocio. Pasala siempre que la haya dicho: es lo que permite explicar por qué no y ordenar las alternativas',
        },
        from: {
          type: 'string',
          description:
            'Inicio del rango, ISO 8601 con offset de la zona horaria del negocio (por ejemplo 2026-08-09T00:00:00-04:00)',
        },
        to: {
          type: 'string',
          description:
            'Fin del rango, ISO 8601 con offset de la zona horaria del negocio. Máximo 14 días después de "from"',
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

    let result: AvailabilityOptions;
    try {
      result = await this.findOptions.execute({
        serviceId: requiredUuid(values, 'serviceId'),
        professionalId: optionalUuid(values, 'professionalId'),
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
      const reason = this.explain(error);
      if (!reason) throw error;
      return {
        status: 'warning',
        summary: reason,
        nextActions: [
          'Decirlo con honestidad y ofrecer otra profesional u otro servicio.',
        ],
      };
    }

    const timezone = context.timezone;
    const sameDay =
      result.options.length > 0 &&
      result.options.every(
        (option) =>
          this.localDay(option.startsAt, timezone) ===
          this.localDay(result.options[0].startsAt, timezone),
      );
    const availableDays = result.availableDays.map((day) => ({
      label: this.dayLabel(day.date, timezone),
      ranges: day.windows.map(
        (window) =>
          `${this.timeLabel(window.from, timezone)} a ${this.timeLabel(window.to, timezone)}`,
      ),
      // A window ends when the last treatment of the day ends, so its edge is not a time
      // anyone can book. Without this the model works the last start out on its own and
      // gets it wrong.
      lastStart: this.timeLabel(
        this.lastStart(day.windows, result.service.durationMinutes),
        timezone,
      ),
    }));

    return {
      status: 'success',
      summary: this.summarize(result),
      offerableTimes: this.offerableTimes(result, availableDays, timezone),
      data: {
        preferred: result.preferred
          ? {
              label: this.label(result.preferred.at, timezone),
              available: result.preferred.available,
              reason: result.preferred.reason,
              detail: this.detail(result.preferred, timezone),
              professionalName: result.preferred.professionalName,
            }
          : null,
        // When every offer is the same local day, the date lives once at the top so each
        // option is just the clock time the client needs to pick.
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
        })),
        availableDays,
        unavailableDays: result.unavailableDays.map((day) => ({
          label: this.dayLabel(day.date, timezone),
          reason: day.reason,
        })),
        nextAvailable: result.nextAvailable
          ? {
              startsAt: result.nextAvailable.startsAt.toISOString(),
              label: this.label(result.nextAvailable.startsAt, timezone),
              professionalId: result.nextAvailable.professionalId,
              professionalName: result.nextAvailable.professionalName,
              daysAway: result.nextAvailable.daysAway,
            }
          : null,
        clientChoosesProfessional: result.service.clientChoosesProfessional,
      },
      nextActions: this.nextActions(result),
    };
  }

  // Every time this answer authorises the agent to say. Anything else it writes is
  // something it made up, and the orchestrator sends it back before the client sees it.
  private offerableTimes(
    result: AvailabilityOptions,
    availableDays: ReadonlyArray<{ ranges: string[]; lastStart: string }>,
    timezone: string,
  ): string[] {
    return [
      ...result.options.map((option) =>
        this.timeLabel(option.startsAt, timezone),
      ),
      ...availableDays.flatMap((day) => [...day.ranges, day.lastStart]),
      ...(result.preferred
        ? [this.timeLabel(result.preferred.at, timezone)]
        : []),
      ...(result.preferred?.lastStartThatFits
        ? [this.timeLabel(result.preferred.lastStartThatFits, timezone)]
        : []),
      ...(result.nextAvailable
        ? [this.timeLabel(result.nextAvailable.startsAt, timezone)]
        : []),
    ];
  }

  // A free window ends when the last treatment of the day ends, so the last start that can
  // still be booked sits one treatment before that edge.
  private lastStart(windows: FreeWindow[], durationMinutes: number): Date {
    const last = windows[windows.length - 1];
    return new Date(last.to.getTime() - durationMinutes * 60_000);
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
        'Decir el motivo concreto que viene en preferred.reason y preferred.detail, no un "no hay disponibilidad" genérico.',
      );
    }
    if (!result.preferred && result.availableDays.length) {
      actions.push(
        'Describir el día con las franjas de "availableDays" y ofrecer solo los horarios de "options", que son pocos a propósito. Una franja dice hasta cuándo hay lugar, no es una lista: no la desgloses en horarios.',
      );
    } else if (result.options.length) {
      actions.push(
        'Ofrecer solo los horarios de "options", tal cual vienen. No completes con horarios propios.',
      );
    } else if (result.nextAvailable) {
      actions.push(
        `No hay nada cerca: decir que el primer hueco es ${result.nextAvailable.professionalName} en ${result.nextAvailable.daysAway} días y preguntar si le sirve.`,
      );
    } else {
      actions.push(
        'No hay ningún horario en los próximos 90 días: decilo con honestidad y derivá al equipo.',
      );
    }
    if (!result.service.clientChoosesProfessional) {
      actions.push(
        'Este servicio no ofrece elegir profesional: no preguntes con quién, asigná la que aparece en la opción.',
      );
    }

    return actions;
  }

  // The sentence the agent needs is in the reason plus one concrete fact: the last start
  // that still fits, or how much notice the business needs.
  private detail(
    preferred: PreferredDiagnosis,
    timezone: string,
  ): string | null {
    switch (preferred.reason) {
      case AvailabilityReason.SERVICE_DOES_NOT_FIT:
        return preferred.lastStartThatFits
          ? `Ese tratamiento ya no entra antes del cierre. La última hora de inicio posible ese día es ${this.timeLabel(preferred.lastStartThatFits, timezone)}.`
          : 'Ese tratamiento no entra en el horario de ese día.';
      case AvailabilityReason.TOO_SOON:
        return `El negocio necesita ${preferred.leadTimeHours} horas de anticipación para reservar.`;
      case AvailabilityReason.BUSINESS_CLOSED:
        return 'El negocio no atiende ese día.';
      case AvailabilityReason.PROFESSIONAL_OFF:
        return 'La profesional no trabaja ese día.';
      case AvailabilityReason.BEFORE_OPENING:
        return 'Es antes de la hora de apertura.';
      case AvailabilityReason.TAKEN:
        return 'Ese horario ya está ocupado.';
      default:
        return null;
    }
  }

  private explain(error: unknown): string | null {
    if (error instanceof SlotUnavailableError) {
      return 'Esa profesional no realiza ese servicio, o alguno de los dos está inactivo.';
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

  private localDay(at: Date, timezone: string): string {
    return this.local(at, timezone).toISODate() ?? '';
  }

  private local(at: Date, timezone: string): DateTime {
    return DateTime.fromJSDate(at).setZone(timezone).setLocale('es');
  }
}
