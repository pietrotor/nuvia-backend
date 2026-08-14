import { Injectable } from '@nestjs/common';

import { RescheduleAppointmentUseCase } from '@application/appointments/use-cases/reschedule-appointment.use-case';
import { BookingActor } from '@domain/appointments/value-objects/booking-actor.vo';
import {
  BranchNotFoundError,
  BranchRequiredError,
  ProfessionalNotAtBranchError,
  ServiceNotOfferedAtBranchError,
} from '@domain/branches/exceptions/branch.exceptions';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { branchRequiredWarning } from './branch-required.warning';
import { clockLabel } from './clock-label';
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
        branchId: {
          type: 'string',
          description:
            'Solo si la clienta quiere cambiar de sucursal. Si se omite, se mantiene la de la cita (o la de la conversación).',
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

    let result;
    try {
      result = await this.rescheduleAppointment.execute(
        requiredUuid(values, 'appointmentId'),
        {
          startsAt: requiredIsoDate(values, 'startsAt'),
          professionalId: optionalUuid(values, 'professionalId'),
          branchId:
            optionalUuid(values, 'branchId') ?? context.branchId ?? undefined,
        },
        { restrictToClientId: context.clientId, actor: BookingActor.CLIENT },
      );
    } catch (error) {
      if (error instanceof BranchRequiredError) {
        return branchRequiredWarning();
      }
      if (error instanceof BranchNotFoundError) {
        return {
          status: 'warning',
          summary: 'Esa sucursal no existe o no está activa.',
          nextActions: ['Ofrecer otra sucursal o derivar.'],
        };
      }
      if (error instanceof ServiceNotOfferedAtBranchError) {
        return {
          status: 'warning',
          summary: 'Ese servicio no se ofrece en la sucursal pedida.',
          nextActions: ['Ofrecer otra sucursal o derivar.'],
        };
      }
      if (error instanceof ProfessionalNotAtBranchError) {
        return {
          status: 'warning',
          summary: 'Esa profesional no atiende en la sucursal pedida.',
          nextActions: ['Ofrecer otra profesional o sucursal.'],
        };
      }
      throw error;
    }

    return {
      status: 'success',
      summary: 'Cita reagendada.',
      offerableTimes: [
        clockLabel(result.appointment.startsAt, context.timezone),
      ],
      data: {
        appointmentId: result.appointment.id,
        branchId: result.appointment.branchId,
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
