import { Injectable } from '@nestjs/common';

import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import { ListBranchesUseCase } from '@application/branches/use-cases/list-branches.use-case';
import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import {
  BranchNotFoundError,
  BranchRequiredError,
} from '@domain/branches/exceptions/branch.exceptions';
import { DayHours } from '@domain/business-config/entities/business-config.entity';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';

@Injectable()
export class GetBusinessInfoAgentTool implements AgentTool {
  readonly definition = {
    name: 'get_business_info',
    description:
      'Obtiene dirección, horarios, preguntas frecuentes y políticas del negocio (y de la sucursal si ya está elegida).',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  constructor(
    private readonly getConfig: GetBusinessConfigUseCase,
    private readonly branchResolver: BranchResolver,
    private readonly listBranches: ListBranchesUseCase,
  ) {}

  async execute(
    _input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const config = await this.getConfig.execute();

    try {
      const branch = await this.branchResolver.resolve(
        context.branchId ?? undefined,
      );
      return {
        status: 'success',
        summary: 'Información del negocio encontrada.',
        // Opening and closing times: without them the agent could not say "atendemos
        // hasta las 18:00" without tripping the check on invented times.
        offerableTimes: Object.values(branch.weeklyHours)
          .filter((day): day is DayHours => day !== null)
          .flatMap((day) => [day.start, day.end]),
        data: {
          branch: {
            id: branch.id,
            name: branch.name,
            address: branch.address,
            mapsUrl: branch.mapsUrl,
            businessHours: branch.weeklyHours,
          },
          bookingPolicy: config.bookingPolicy,
          faq: config.faq,
        },
      };
    } catch (error) {
      if (error instanceof BranchRequiredError) {
        const branches = (await this.listBranches.execute(true)).map(
          (branch) => ({
            id: branch.id,
            name: branch.name,
            address: branch.address,
            mapsUrl: branch.mapsUrl,
          }),
        );
        return {
          status: 'success',
          summary:
            'Hay varias sucursales: todavía no hay una sola dirección para esta conversación.',
          data: {
            branches,
            bookingPolicy: config.bookingPolicy,
            faq: config.faq,
          },
          nextActions: [
            'Si la clienta pregunta por dirección u horarios de un local, listar las sucursales y fijar una con set_branch.',
          ],
        };
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
  }
}
