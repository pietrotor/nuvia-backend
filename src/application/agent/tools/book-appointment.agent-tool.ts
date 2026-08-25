import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import { BookAppointmentUseCase } from '@application/appointments/use-cases/book-appointment.use-case';
import { BookAppointmentDto } from '@application/appointments/dto/book-appointment.dto';
import { GetAppointmentUseCase } from '@application/appointments/use-cases/get-appointment.use-case';
import { GetBranchUseCase } from '@application/branches/use-cases/get-branch.use-case';
import { ResolveBookingAttendeeUseCase } from '@application/clients/use-cases/resolve-booking-attendee.use-case';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import {
  BookingAnswerInvalidError,
  BookingAnswersIncompleteError,
  BookingQuestionNotFoundError,
  ClientNameRequiredError,
  SlotUnavailableError,
} from '@domain/appointments/exceptions/appointment.exceptions';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import {
  BranchNotFoundError,
  BranchRequiredError,
  ProfessionalDoesNotPerformServiceError,
  ProfessionalNotAtBranchError,
  ServiceNotOfferedAtBranchError,
} from '@domain/branches/exceptions/branch.exceptions';
import {
  DEPOSIT_QR_REPOSITORY,
  DepositQrRepository,
} from '@domain/deposits/repositories/deposit-qr.repository';
import { ProfessionalNotFoundError } from '@domain/professionals/exceptions/professional.exceptions';
import { ServiceNotFoundError } from '@domain/services/exceptions/service.exceptions';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { branchRequiredWarning } from './branch-required.warning';
import { clockLabel } from './clock-label';
import {
  asObject,
  optionalString,
  optionalUuid,
  requiredIsoDate,
  requiredUuid,
} from './tool-input';

@Injectable()
export class BookAppointmentAgentTool implements AgentTool {
  readonly definition = {
    name: 'book_appointment',
    description:
      'Agenda un turno luego de que la clienta confirme el resumen (a nombre de quién, servicio, profesional, horario y, si aplica, respuestas). Por defecto el turno es para quien escribe: no hace falta preguntarlo aparte.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: [
        'serviceId',
        'professionalId',
        'startsAt',
        'bookingForSelf',
        'attendeeConfirmed',
        'confirmedByClient',
      ],
      properties: {
        serviceId: { type: 'string' },
        professionalId: { type: 'string' },
        startsAt: { type: 'string', description: 'Fecha y hora ISO 8601' },
        branchId: {
          type: 'string',
          description:
            'UUID de la sucursal. Obligatorio si el horario existe en más de una o todavía no hay sucursal fijada.',
        },
        bookingForSelf: {
          type: 'boolean',
          description:
            'true por defecto (turno para quien escribe). false solo si dijo que es para otra persona o corrigió el nombre del resumen.',
        },
        attendeeClientId: {
          type: 'string',
          description:
            'UUID de list_booking_attendees cuando eligió a alguien ya conocido.',
        },
        attendeeName: {
          type: 'string',
          description:
            'Nombre de quien se atiende, si no es para quien escribe y todavía no está en la lista.',
        },
        attendeeConfirmed: {
          type: 'boolean',
          description:
            'true cuando el resumen confirmado ya incluía "a nombre de …", o cuando corrigió y ya quedó claro a nombre de quién.',
        },
        answers: {
          type: 'array',
          description:
            'Respuestas a las preguntas de reserva del servicio (questionId + value).',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['questionId', 'value'],
            properties: {
              questionId: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
        confirmedByClient: {
          type: 'boolean',
          description:
            'Debe ser true solo tras confirmación explícita del resumen',
        },
      },
    },
  };

  constructor(
    private readonly bookAppointment: BookAppointmentUseCase,
    private readonly resolveAttendee: ResolveBookingAttendeeUseCase,
    private readonly getAppointment: GetAppointmentUseCase,
    private readonly getBranch: GetBranchUseCase,
    @Inject(DEPOSIT_QR_REPOSITORY)
    private readonly depositQrs: DepositQrRepository,
  ) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const values = asObject(input);
    if (values.confirmedByClient !== true) {
      return {
        status: 'warning',
        summary: 'Falta confirmación explícita de la clienta.',
        nextActions: ['Pedir confirmación antes de reservar.'],
      };
    }
    if (values.attendeeConfirmed !== true) {
      return {
        status: 'warning',
        summary:
          'Falta que el resumen confirme a nombre de quién queda el turno.',
        nextActions: [
          'Incluir "a nombre de [nombre]" en el resumen y pedir confirmación.',
          'Si corrigió y es para otra persona, pedí el nombre o usá list_booking_attendees.',
        ],
      };
    }

    let request: BookAppointmentDto;
    try {
      const attendee = await this.resolveAttendee.execute({
        contactClientId: context.clientId,
        bookingForSelf: values.bookingForSelf === true,
        attendeeClientId: optionalUuid(values, 'attendeeClientId'),
        attendeeName: optionalString(values, 'attendeeName'),
      });

      request = {
        clientId: attendee.id,
        bookingContactClientId: context.clientId,
        serviceId: requiredUuid(values, 'serviceId'),
        professionalId: requiredUuid(values, 'professionalId'),
        startsAt: requiredIsoDate(values, 'startsAt'),
        branchId:
          optionalUuid(values, 'branchId') ?? context.branchId ?? undefined,
        answers: parseAnswers(values.answers),
      };
    } catch (error) {
      if (error instanceof ClientNameRequiredError) {
        return {
          status: 'warning',
          summary:
            'No se reservó nada: falta el nombre real de quien va a atenderse.',
          nextActions: [
            'Si falta el de quien escribe, usar confirm_client_name.',
            'Si es para otra persona, pedir su nombre y volver a reservar.',
          ],
        };
      }
      return {
        status: 'warning',
        summary:
          'No se reservó nada: el identificador del servicio o de la profesional no es uno real, o la fecha no vino en ISO 8601.',
        nextActions: [
          'Copiar el identificador exacto del catálogo, nunca uno armado a partir del nombre.',
          'No decir que la reserva quedó hecha: la agenda sigue igual.',
        ],
      };
    }

    let appointment: Awaited<ReturnType<BookAppointmentUseCase['execute']>>;
    try {
      appointment = await this.bookAppointment.execute(
        request,
        BookingActor.CLIENT,
      );
    } catch (error) {
      if (error instanceof BranchRequiredError) {
        return branchRequiredWarning();
      }
      const reason = this.explain(error);
      if (!reason) throw error;
      return {
        status: 'warning',
        summary: reason,
        nextActions: [
          'Decir con honestidad que no se pudo reservar ese horario.',
          'Buscar horarios reales con find_availability y ofrecer solo los que devuelva.',
        ],
      };
    }

    const awaitsDeposit =
      appointment.status === AppointmentStatus.PENDING_DEPOSIT;
    const [view, branch, chargeable] = await Promise.all([
      this.getAppointment.execute(appointment.id),
      this.getBranch.execute(appointment.branchId),
      awaitsDeposit ? this.canChargeADeposit() : Promise.resolve(false),
    ]);
    const startsAtLabel = clockLabel(appointment.startsAt, context.timezone);
    const dateLabel = DateTime.fromJSDate(appointment.startsAt)
      .setZone(context.timezone)
      .setLocale('es')
      .toFormat("cccc d 'de' LLLL 'de' yyyy");
    return {
      status: 'success',
      summary: awaitsDeposit
        ? 'Turno reservado, pendiente de seña.'
        : 'Turno reservado y confirmado.',
      offerableTimes: [startsAtLabel],
      data: {
        appointmentId: appointment.id,
        attendee: {
          clientId: view.client.id,
          name: view.client.name,
        },
        service: {
          serviceId: view.service.id,
          name: view.service.name,
        },
        professional: {
          professionalId: view.professional.id,
          name: view.professional.name,
        },
        branch: {
          branchId: branch.id,
          name: branch.name,
          address: branch.address,
          mapsUrl: branch.mapsUrl,
        },
        bookingContactClientId: appointment.bookingContactClientId,
        startsAt: appointment.startsAt,
        dateLabel,
        startsAtLabel,
        endsAt: appointment.endsAt,
        status: appointment.status,
      },
      nextActions: awaitsDeposit
        ? chargeable
          ? [
              'No repetir la checklist previa. Abrir con el resultado y enviar el comprobante compacto en tres viñetas: Cuándo, Atención y Dónde; pasar el mapa aparte si existe.',
              'Usar solamente los datos devueltos por esta herramienta y avisar que el QR de la seña llega en el siguiente mensaje.',
              'No calcular ni mencionar el monto de la seña: va en el mensaje del QR.',
            ]
          : [
              'No repetir la checklist previa. Abrir con el resultado y enviar el comprobante compacto en tres viñetas: Cuándo, Atención y Dónde; pasar el mapa aparte si existe.',
              'No prometer ningún QR: no va a salir ninguna imagen. Decir que el turno queda con la seña pendiente y que el equipo pasa los datos del pago.',
              'Derivar con request_handoff para que una persona pase los datos del pago.',
            ]
        : [
            'No repetir la checklist previa. Abrir diciendo que quedó confirmada y enviar el comprobante compacto en tres viñetas: Cuándo, Atención y Dónde; pasar el mapa aparte si existe.',
            'Usar solamente los datos devueltos por esta herramienta.',
            'No mencionar seña ni QR: este servicio no cobra anticipo y no va a salir ninguna imagen.',
          ],
      followUp:
        awaitsDeposit && chargeable
          ? { kind: 'deposit_qr', appointmentId: appointment.id }
          : undefined,
    };
  }

  // The QR follow-up is sent after the answer is already out, so a business with nothing
  // to charge with left the client holding a promise of an image that never came. Which
  // of several QRs applies is still resolved at send time; this only asks whether any
  // exists, because none means no send can ever succeed.
  private async canChargeADeposit(): Promise<boolean> {
    const depositQrs = await this.depositQrs.findAll();
    return depositQrs.length > 0;
  }

  private explain(error: unknown): string | null {
    if (error instanceof ProfessionalDoesNotPerformServiceError) {
      return 'Esa profesional no realiza ese servicio, así que no se reservó nada.';
    }
    if (error instanceof SlotUnavailableError) {
      return 'Ese horario no se puede reservar: la profesional no trabaja en ese momento, ya está ocupado, o no realiza ese servicio.';
    }
    if (error instanceof ProfessionalNotFoundError) {
      return 'No existe esa profesional, así que no se reservó nada.';
    }
    if (error instanceof ServiceNotFoundError) {
      return 'No existe ese servicio, así que no se reservó nada.';
    }
    if (error instanceof BranchNotFoundError) {
      return 'La sucursal de esta conversación ya no está disponible, así que no se reservó nada.';
    }
    if (error instanceof ServiceNotOfferedAtBranchError) {
      return 'Ese servicio no se ofrece en esta sucursal, así que no se reservó nada.';
    }
    if (error instanceof ProfessionalNotAtBranchError) {
      return 'Esa profesional no atiende en esta sucursal, así que no se reservó nada.';
    }
    if (error instanceof ClientNameRequiredError) {
      return 'No se reservó nada: falta el nombre real de quien va a atenderse.';
    }
    if (error instanceof BookingAnswersIncompleteError) {
      return 'No se reservó nada: faltan respuestas obligatorias de este servicio.';
    }
    if (error instanceof BookingQuestionNotFoundError) {
      return 'No se reservó nada: una pregunta de ese servicio ya no está vigente. Pedí de nuevo las que liste el catálogo.';
    }
    if (error instanceof BookingAnswerInvalidError) {
      return 'No se reservó nada: una respuesta no es válida. Para sí/no usá sí o no.';
    }
    return null;
  }
}

function parseAnswers(
  raw: unknown,
): { questionId: string; value: string }[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) throw new Error('answers must be an array');
  return raw.map((item) => {
    const row = asObject(item);
    return {
      questionId: requiredUuid(row, 'questionId'),
      value: optionalString(row, 'value') ?? '',
    };
  });
}
