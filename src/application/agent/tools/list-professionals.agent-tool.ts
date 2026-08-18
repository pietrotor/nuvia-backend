import { Injectable } from '@nestjs/common';

import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import { ListBranchProfessionalsUseCase } from '@application/branches/use-cases/list-branch-professionals.use-case';
import { ListBranchesUseCase } from '@application/branches/use-cases/list-branches.use-case';
import { ListProfessionalsUseCase } from '@application/professionals/use-cases/list-professionals.use-case';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  describeWorkingDayNames,
  intersectWeeklyHours,
} from '@domain/business-config/services/weekly-hours';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';

@Injectable()
export class ListProfessionalsAgentTool implements AgentTool {
  readonly definition = {
    name: 'list_professionals',
    description:
      'Lista profesionales activos del negocio (o de la sucursal fijada), con su nombre, identificador, días que trabajan y en qué sucursales.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  constructor(
    private readonly branchResolver: BranchResolver,
    private readonly listBranches: ListBranchesUseCase,
    private readonly listBranchProfessionals: ListBranchProfessionalsUseCase,
    private readonly listProfessionals: ListProfessionalsUseCase,
  ) {}

  async execute(
    _input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    let branchId: string | null = context.branchId;
    if (branchId) {
      try {
        branchId = (await this.branchResolver.resolve(branchId)).id;
      } catch (error) {
        if (error instanceof BranchNotFoundError) {
          return {
            status: 'warning',
            summary: 'La sucursal de esta conversación ya no está disponible.',
            nextActions: [
              'Llamar a list_branches y fijar otra con set_branch.',
            ],
          };
        }
        throw error;
      }
    }

    const [branches, professionals] = await Promise.all([
      this.listBranches.execute(true),
      this.listProfessionals.execute(),
    ]);
    const byId = new Map(
      professionals.map((professional) => [professional.id, professional]),
    );
    const branchIds = branchId ? [branchId] : branches.map((b) => b.id);
    const branchById = new Map(branches.map((b) => [b.id, b]));

    const listed = new Map<
      string,
      { id: string; name: string; workingDays: string[]; branchNames: string[] }
    >();

    for (const id of branchIds) {
      const branch = branchById.get(id);
      if (!branch) continue;
      const assignments = await this.listBranchProfessionals.execute(id, true);
      for (const assignment of assignments) {
        const professional = byId.get(assignment.professionalId);
        if (!professional || !professional.isActive) continue;
        const days = describeWorkingDayNames(
          intersectWeeklyHours(branch.weeklyHours, assignment.weeklyHours),
        );
        const existing = listed.get(professional.id);
        if (existing) {
          if (!existing.branchNames.includes(branch.name)) {
            existing.branchNames.push(branch.name);
          }
          for (const day of days) {
            if (!existing.workingDays.includes(day)) {
              existing.workingDays.push(day);
            }
          }
        } else {
          listed.set(professional.id, {
            id: professional.id,
            name: professional.name,
            workingDays: days,
            branchNames: [branch.name],
          });
        }
      }
    }

    const rows = [...listed.values()];
    return {
      status: 'success',
      summary: `${rows.length} profesionales activos encontrados.`,
      data: rows,
      nextActions: [
        'Los días de trabajo son orientativos: los horarios libres salen de find_availability.',
      ],
    };
  }
}
