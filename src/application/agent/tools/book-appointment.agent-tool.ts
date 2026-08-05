import { Injectable } from '@nestjs/common';

import { BookAppointmentUseCase } from '@application/appointments/use-cases/book-appointment.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, requiredIsoDate, requiredUuid } from './tool-input';

@Injectable()
export class BookAppointmentAgentTool implements AgentTool {
  readonly definition = {
    name: 'book_appointment',
    description:
      'Agenda un turno luego de que la clienta confirme explícitamente servicio, profesional y horario.',
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

    const appointment = await this.bookAppointment.execute({
      clientId: context.clientId,
      serviceId: requiredUuid(values, 'serviceId'),
      professionalId: requiredUuid(values, 'professionalId'),
      startsAt: requiredIsoDate(values, 'startsAt'),
    });
    return {
      status: 'success',
      summary: 'Turno reservado correctamente.',
      data: {
        appointmentId: appointment.id,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        status: appointment.status,
      },
      nextActions: ['Informar la reserva y próximos pasos de seña si aplica.'],
    };
  }
}
