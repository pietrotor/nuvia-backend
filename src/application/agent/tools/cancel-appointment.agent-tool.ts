import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

import { CancelAppointmentUseCase } from '@application/appointments/use-cases/cancel-appointment.use-case';
import { GetAppointmentUseCase } from '@application/appointments/use-cases/get-appointment.use-case';
import { GetBranchUseCase } from '@application/branches/use-cases/get-branch.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { clockLabel } from './clock-label';
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

  constructor(
    private readonly cancelAppointment: CancelAppointmentUseCase,
    private readonly getAppointment: GetAppointmentUseCase,
    private readonly getBranch: GetBranchUseCase,
  ) {}

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

    const appointmentId = requiredUuid(values, 'appointmentId');
    const result = await this.cancelAppointment.execute(
      appointmentId,
      { reason: optionalString(values, 'reason') },
      context.clientId,
    );
    const view = await this.getAppointment.execute(result.appointment.id);
    const branch = view.appointment.branchId
      ? await this.getBranch.execute(view.appointment.branchId)
      : null;
    const startsAtLabel = clockLabel(
      view.appointment.startsAt,
      context.timezone,
    );
    const dateLabel = DateTime.fromJSDate(view.appointment.startsAt)
      .setZone(context.timezone)
      .setLocale('es')
      .toFormat("cccc d 'de' LLLL");

    return {
      status: 'success',
      summary: 'Cita cancelada.',
      offerableTimes: [startsAtLabel],
      committedAction: {
        operation: 'appointment.cancel',
        resourceType: 'appointment',
        resourceId: result.appointment.id,
        outcome: 'committed',
        facts: {
          status: result.appointment.status,
          startsAtLabel,
          dateLabel,
          serviceName: view.service.name,
          professionalName: view.professional.name,
          attendeeName: view.client.name,
          branchName: branch?.name,
          depositAtRisk: result.depositAtRisk,
        },
      },
      data: {
        appointmentId: result.appointment.id,
        status: result.appointment.status,
        depositAtRisk: result.depositAtRisk,
      },
      nextActions: result.depositAtRisk
        ? [
            'El sistema confirma la cancelación; no inventes el estado.',
            'Avisar que fue fuera del plazo y la seña puede retenerse; la dueña define.',
          ]
        : [
            'El sistema confirma la cancelación; no inventes el estado.',
            'Ofrecer reagendar más adelante si corresponde.',
          ],
    };
  }
}
