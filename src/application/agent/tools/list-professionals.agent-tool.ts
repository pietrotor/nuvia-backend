import { Injectable } from '@nestjs/common';

import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import { ListBranchProfessionalsUseCase } from '@application/branches/use-cases/list-branch-professionals.use-case';
import { ListProfessionalsUseCase } from '@application/professionals/use-cases/list-professionals.use-case';
import {
  BranchNotFoundError,
  BranchRequiredError,
} from '@domain/branches/exceptions/branch.exceptions';
import { describeWorkingDays } from '@domain/business-config/services/weekly-hours';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { branchRequiredWarning } from './branch-required.warning';

@Injectable()
export class ListProfessionalsAgentTool implements AgentTool {
  readonly definition = {
    name: 'list_professionals',
    description:
      'Lista profesionales activos de la sucursal de la conversación, con su nombre, identificador y días que trabajan ahí.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  constructor(
    private readonly branchResolver: BranchResolver,
    private readonly listBranchProfessionals: ListBranchProfessionalsUseCase,
    private readonly listProfessionals: ListProfessionalsUseCase,
  ) {}

  async execute(
    _input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    let branchId: string;
    try {
      branchId = (
        await this.branchResolver.resolve(context.branchId ?? undefined)
      ).id;
    } catch (error) {
      if (error instanceof BranchRequiredError) {
        return branchRequiredWarning();
      }
      if (error instanceof BranchNotFoundError) {
        return {
          status: 'warning',
          summary: 'La sucursal de esta conversación ya no está disponible.',
          nextActions: ['Llamar a list_branches y fijar otra con set_branch.'],
        };
      }
      throw error;
    }

    const [assignments, professionals] = await Promise.all([
      this.listBranchProfessionals.execute(branchId, true),
      this.listProfessionals.execute(),
    ]);
    const byId = new Map(
      professionals.map((professional) => [professional.id, professional]),
    );

    const listed = assignments
      .map((assignment) => {
        const professional = byId.get(assignment.professionalId);
        if (!professional || !professional.isActive) return null;
        return {
          id: professional.id,
          name: professional.name,
          workingDays: describeWorkingDays(assignment.weeklyHours),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return {
      status: 'success',
      summary: `${listed.length} profesionales activos encontrados.`,
      data: listed,
      nextActions: [
        'Los días de trabajo son orientativos: los horarios libres salen de find_availability.',
      ],
    };
  }
}
