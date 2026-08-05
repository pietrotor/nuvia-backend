import { Injectable } from '@nestjs/common';

import { ListProfessionalsUseCase } from '@application/professionals/use-cases/list-professionals.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';

@Injectable()
export class ListProfessionalsAgentTool implements AgentTool {
  readonly definition = {
    name: 'list_professionals',
    description: 'Lista profesionales activos con su nombre e identificador.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  constructor(private readonly listProfessionals: ListProfessionalsUseCase) {}

  async execute(
    _input: unknown,
    _context: AgentContext,
  ): Promise<AgentToolResult> {
    const professionals = (await this.listProfessionals.execute())
      .filter((professional) => professional.isActive)
      .map((professional) => ({
        id: professional.id,
        name: professional.name,
      }));

    return {
      status: 'success',
      summary: `${professionals.length} profesionales activos encontrados.`,
      data: professionals,
    };
  }
}
