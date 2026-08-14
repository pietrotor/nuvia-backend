import { Injectable } from '@nestjs/common';

import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import { ListBranchServicesUseCase } from '@application/branches/use-cases/list-branch-services.use-case';
import { ListServicesUseCase } from '@application/services/use-cases/list-services.use-case';
import {
  BranchNotFoundError,
  BranchRequiredError,
} from '@domain/branches/exceptions/branch.exceptions';
import { resolveEffectiveBranchService } from '@domain/branches/services/effective-branch-service';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { branchRequiredWarning } from './branch-required.warning';

@Injectable()
export class ListServicesAgentTool implements AgentTool {
  readonly definition = {
    name: 'list_services',
    description:
      'Lista servicios activos de la sucursal de la conversación: duración, precio, seña y profesionales habilitados.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };

  constructor(
    private readonly branchResolver: BranchResolver,
    private readonly listBranchServices: ListBranchServicesUseCase,
    private readonly listServices: ListServicesUseCase,
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

    const [offers, catalog] = await Promise.all([
      this.listBranchServices.execute(branchId, true),
      this.listServices.execute(),
    ]);
    const byId = new Map(catalog.map((service) => [service.id, service]));

    const services = offers
      .map((offer) => {
        const service = byId.get(offer.serviceId);
        if (!service || !service.isActive) return null;
        const effective = resolveEffectiveBranchService(service, offer);
        return {
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price: effective.price.display(),
          requiresDeposit: service.requiresDeposit,
          depositAmount: effective.depositAmount?.display() ?? null,
          depositPercent: service.depositPercent,
          professionalIds: service.professionalIds,
        };
      })
      .filter(
        (service): service is NonNullable<typeof service> => service !== null,
      );

    return {
      status: 'success',
      summary: `${services.length} servicios activos encontrados.`,
      data: services,
      nextActions: ['Elegir un servicio antes de buscar horarios.'],
    };
  }
}
