import { Injectable } from '@nestjs/common';

import { ListBranchesUseCase } from '@application/branches/use-cases/list-branches.use-case';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';

@Injectable()
export class ListBranchesAgentTool implements AgentTool {
  readonly definition = {
    name: 'list_branches',
    description:
      'Lista las sucursales activas del negocio (nombre, dirección y mapa). Usala cuando hay más de una y la clienta todavía no eligió dónde atenderse.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  constructor(private readonly listBranches: ListBranchesUseCase) {}

  async execute(
    _input: unknown,
    _context: AgentContext,
  ): Promise<AgentToolResult> {
    const branches = (await this.listBranches.execute(true)).map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      mapsUrl: branch.mapsUrl,
    }));

    return {
      status: 'success',
      summary: `${branches.length} sucursales activas.`,
      data: branches,
      nextActions: branches.length
        ? [
            'Preguntar a la clienta en cuál sucursal quiere atenderse.',
            'Cuando elija, llamar a set_branch con el id correspondiente.',
          ]
        : ['Derivar: no hay sucursales activas configuradas.'],
    };
  }
}
