import { Inject, Injectable } from '@nestjs/common';

import { ListClientAppointmentsUseCase } from '@application/appointments/use-cases/list-client-appointments.use-case';
import {
  BRANCH_REPOSITORY,
  BranchRepository,
} from '@domain/branches/repositories/branch.repository';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { clockLabel } from './clock-label';

@Injectable()
export class ListMyAppointmentsAgentTool implements AgentTool {
  readonly definition = {
    name: 'list_my_appointments',
    description:
      'Lista las próximas citas activas de la clienta de esta conversación. Usalo antes de reagendar o cancelar.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: [],
      properties: {},
    },
  };

  constructor(
    private readonly listClientAppointments: ListClientAppointmentsUseCase,
    @Inject(BRANCH_REPOSITORY)
    private readonly branches: BranchRepository,
  ) {}

  async execute(
    _input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const appointments = await this.listClientAppointments.execute({
      clientId: context.clientId,
      onlyUpcoming: true,
      scope: 'managed',
    });

    const branchIds = [
      ...new Set(
        appointments
          .map((view) => view.appointment.branchId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const branchNameById = new Map<string, string>();
    await Promise.all(
      branchIds.map(async (id) => {
        const branch = await this.branches.findById(id);
        if (branch) branchNameById.set(id, branch.name);
      }),
    );

    return {
      status: 'success',
      summary: `${appointments.length} citas próximas.`,
      offerableTimes: appointments.map((view) =>
        clockLabel(view.appointment.startsAt, context.timezone),
      ),
      // Names, not just ids: the agent talks to the client about "Limpieza facial
      // con Camila", while the ids are what it needs to look up availability.
      data: appointments.map((view) => ({
        appointmentId: view.appointment.id,
        service: view.service.name,
        serviceId: view.service.id,
        professional: view.professional.name,
        professionalId: view.professional.id,
        branchId: view.appointment.branchId,
        branchName: view.appointment.branchId
          ? (branchNameById.get(view.appointment.branchId) ?? null)
          : null,
        startsAt: view.appointment.startsAt,
        status: view.appointment.status,
      })),
      nextActions: appointments.length
        ? ['Confirmar con la clienta cuál cita quiere cambiar.']
        : ['Avisar que no hay citas próximas registradas.'],
    };
  }
}
