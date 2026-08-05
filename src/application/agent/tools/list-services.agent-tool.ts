import { Injectable } from '@nestjs/common';

import { ListServicesUseCase } from '@application/services/use-cases/list-services.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';

@Injectable()
export class ListServicesAgentTool implements AgentTool {
  readonly definition = {
    name: 'list_services',
    description:
      'Lista servicios activos, duración, precio, seña y profesionales habilitados.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  constructor(private readonly listServices: ListServicesUseCase) {}

  async execute(
    _input: unknown,
    _context: AgentContext,
  ): Promise<AgentToolResult> {
    const services = (await this.listServices.execute())
      .filter((service) => service.isActive)
      .map((service) => ({
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        // Already formatted in the business currency so the agent quotes prices the
        // way the client reads them and never invents a symbol.
        price: service.price.display(),
        requiresDeposit: service.requiresDeposit,
        depositAmount: service.depositAmount?.display() ?? null,
        depositPercent: service.depositPercent,
        professionalIds: service.professionalIds,
      }));
    return {
      status: 'success',
      summary: `${services.length} servicios activos encontrados.`,
      data: services,
      nextActions: ['Elegir un servicio antes de buscar horarios.'],
    };
  }
}
