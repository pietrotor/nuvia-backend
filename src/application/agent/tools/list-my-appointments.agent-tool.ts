import { Injectable } from '@nestjs/common';

import { ListClientAppointmentsUseCase } from '@application/appointments/use-cases/list-client-appointments.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';

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
  ) {}

  async execute(
    _input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const appointments = await this.listClientAppointments.execute({
      clientId: context.clientId,
      onlyUpcoming: true,
    });

    return {
      status: 'success',
      summary: `${appointments.length} citas próximas.`,
      // Names, not just ids: the agent talks to the client about "Limpieza facial
      // con Camila", while the ids are what it needs to look up availability.
      data: appointments.map((view) => ({
        appointmentId: view.appointment.id,
        service: view.service.name,
        serviceId: view.service.id,
        professional: view.professional.name,
        professionalId: view.professional.id,
        startsAt: view.appointment.startsAt,
        status: view.appointment.status,
      })),
      nextActions: appointments.length
        ? ['Confirmar con la clienta cuál cita quiere cambiar.']
        : ['Avisar que no hay citas próximas registradas.'],
    };
  }
}
