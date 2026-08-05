import { Injectable } from '@nestjs/common';

import { CancelAppointmentUseCase } from '@application/appointments/use-cases/cancel-appointment.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, optionalString, requiredUuid } from './tool-input';

@Injectable()
export class CancelAppointmentAgentTool implements AgentTool {
  readonly definition = {
    name: 'cancel_appointment',
    description:
      'Cancela una cita de la clienta, tras confirmación explícita de que quiere cancelarla.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['appointmentId', 'confirmedByClient'],
      properties: {
        appointmentId: { type: 'string' },
        reason: { type: 'string', description: 'Motivo que dio la clienta' },
        confirmedByClient: {
          type: 'boolean',
          description: 'Debe ser true solo tras confirmación explícita',
        },
      },
    },
  };

  constructor(private readonly cancelAppointment: CancelAppointmentUseCase) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const values = asObject(input);
    if (values.confirmedByClient !== true) {
      return {
        status: 'warning',
        summary: 'Falta confirmación explícita de la cancelación.',
        nextActions: ['Preguntar si confirma cancelar la cita.'],
      };
    }

    const result = await this.cancelAppointment.execute(
      requiredUuid(values, 'appointmentId'),
      { reason: optionalString(values, 'reason') },
      context.clientId,
    );

    return {
      status: 'success',
      summary: 'Cita cancelada.',
      data: {
        appointmentId: result.appointment.id,
        status: result.appointment.status,
        depositAtRisk: result.depositAtRisk,
      },
      nextActions: result.depositAtRisk
        ? [
            'Confirmar la cancelación.',
            'Avisar que fue fuera del plazo y la seña puede retenerse; la dueña define.',
          ]
        : ['Confirmar la cancelación y ofrecer reagendar más adelante.'],
    };
  }
}
