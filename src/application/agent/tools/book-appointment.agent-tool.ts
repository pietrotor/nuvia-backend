import { Injectable } from '@nestjs/common';

import { BookAppointmentUseCase } from '@application/appointments/use-cases/book-appointment.use-case';
import { BookAppointmentDto } from '@application/appointments/dto/book-appointment.dto';
import { AppointmentStatus } from '@domain/appointments/entities/appointment.entity';
import { SlotUnavailableError } from '@domain/appointments/exceptions/appointment.exceptions';
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
import { asObject, requiredIsoDate, requiredUuid } from './tool-input';

@Injectable()
export class BookAppointmentAgentTool implements AgentTool {
  readonly definition = {
    name: 'book_appointment',
    description:
      'Agenda un turno en la sucursal de la conversación luego de que la clienta confirme explícitamente servicio, profesional y horario.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: [
        'serviceId',
        'professionalId',
        'startsAt',
        'confirmedByClient',
      ],
      properties: {
        serviceId: { type: 'string' },
        professionalId: { type: 'string' },
        startsAt: { type: 'string', description: 'Fecha y hora ISO 8601' },
        confirmedByClient: {
          type: 'boolean',
          description: 'Debe ser true solo tras confirmación explícita',
        },
      },
    },
  };

  constructor(private readonly bookAppointment: BookAppointmentUseCase) {}

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

    let request: BookAppointmentDto;
    try {
      request = {
        clientId: context.clientId,
        serviceId: requiredUuid(values, 'serviceId'),
        professionalId: requiredUuid(values, 'professionalId'),
        startsAt: requiredIsoDate(values, 'startsAt'),
        branchId: context.branchId ?? undefined,
      };
    } catch {
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
      // A slot that cannot be booked is an answer, not a crash: told apart, the agent can
      // say what happened instead of falling back to a handoff the client did not need.
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
    return {
      status: 'success',
      summary: awaitsDeposit
        ? 'Turno reservado, pendiente de seña.'
        : 'Turno reservado y confirmado.',
      offerableTimes: [clockLabel(appointment.startsAt, context.timezone)],
      data: {
        appointmentId: appointment.id,
        branchId: appointment.branchId,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        status: appointment.status,
      },
      nextActions: awaitsDeposit
        ? [
            'Informar la reserva y avisar que el QR de la seña llega en el siguiente mensaje.',
            'No calcular ni mencionar el monto de la seña: va en el mensaje del QR.',
          ]
        : [
            'Informar la reserva: queda confirmada, sin nada que pagar por adelantado.',
            'No mencionar seña ni QR: este servicio no cobra anticipo y no va a salir ninguna imagen.',
          ],
      followUp: awaitsDeposit
        ? { kind: 'deposit_qr', appointmentId: appointment.id }
        : undefined,
    };
  }

  private explain(error: unknown): string | null {
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
    return null;
  }
}
