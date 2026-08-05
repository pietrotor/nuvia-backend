import { Injectable } from '@nestjs/common';

import { RescheduleAppointmentUseCase } from '@application/appointments/use-cases/reschedule-appointment.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import {
  asObject,
  optionalUuid,
  requiredIsoDate,
  requiredUuid,
} from './tool-input';

@Injectable()
export class RescheduleAppointmentAgentTool implements AgentTool {
  readonly definition = {
    name: 'reschedule_appointment',
    description:
      'Mueve una cita existente a otro horario disponible, tras confirmación explícita de la clienta.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['appointmentId', 'startsAt', 'confirmedByClient'],
      properties: {
        appointmentId: { type: 'string' },
        startsAt: {
          type: 'string',
          description: 'Nueva fecha y hora ISO 8601',
        },
        professionalId: {
          type: 'string',
          description: 'Solo si la clienta acepta otra profesional',
        },
        confirmedByClient: {
          type: 'boolean',
          description: 'Debe ser true solo tras confirmación explícita',
        },
      },
    },
  };

  constructor(
    private readonly rescheduleAppointment: RescheduleAppointmentUseCase,
  ) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const values = asObject(input);
    if (values.confirmedByClient !== true) {
      return {
        status: 'warning',
        summary: 'Falta confirmación explícita del nuevo horario.',
        nextActions: ['Pedir confirmación antes de reagendar.'],
      };
    }

    const result = await this.rescheduleAppointment.execute(
      requiredUuid(values, 'appointmentId'),
      {
        startsAt: requiredIsoDate(values, 'startsAt'),
        professionalId: optionalUuid(values, 'professionalId'),
      },
      context.clientId,
    );

    return {
      status: 'success',
      summary: 'Cita reagendada.',
      data: {
        appointmentId: result.appointment.id,
        startsAt: result.appointment.startsAt,
        endsAt: result.appointment.endsAt,
        status: result.appointment.status,
        depositAtRisk: result.depositAtRisk,
      },
      nextActions: result.depositAtRisk
        ? [
            'Confirmar el nuevo horario.',
            'Avisar que el cambio quedó fuera del plazo y la seña puede retenerse; la dueña define.',
          ]
        : ['Confirmar el nuevo horario.'],
    };
  }
}
