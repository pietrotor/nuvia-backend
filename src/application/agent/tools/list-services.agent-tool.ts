import { Injectable } from '@nestjs/common';

import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import { ListBranchServicesUseCase } from '@application/branches/use-cases/list-branch-services.use-case';
import { ListBranchesUseCase } from '@application/branches/use-cases/list-branches.use-case';
import { ListServicesUseCase } from '@application/services/use-cases/list-services.use-case';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import { resolveEffectiveBranchService } from '@domain/branches/services/effective-branch-service';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, optionalString } from './tool-input';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function scoreService(
  query: string,
  service: { name: string; description?: string | null; keywords?: string[] },
): number {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(service.name);
  if (name === q) return 100;
  if (name.includes(q) || q.includes(name)) return 80;
  const keywords = (service.keywords ?? []).map(normalize);
  if (
    keywords.some(
      (keyword) => keyword === q || keyword.includes(q) || q.includes(keyword),
    )
  ) {
    return 70;
  }
  const description = normalize(service.description ?? '');
  if (description.includes(q)) return 40;
  // Token overlap for "masaje chino" → "Masaje descontracturante"
  const tokens = q.split(/\s+/).filter((token) => token.length > 2);
  if (tokens.length === 0) return 0;
  const haystack = `${name} ${keywords.join(' ')} ${description}`;
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits === 0 ? 0 : (hits / tokens.length) * 50;
}

@Injectable()
export class ListServicesAgentTool implements AgentTool {
  readonly definition = {
    name: 'list_services',
    description:
      'Lista servicios activos del negocio (o de la sucursal fijada): duración, precio, seña, profesionales y en qué sucursales se ofrecen. Pasá "query" cuando la clienta nombre un servicio de forma vaga o con otro nombre.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description:
            'Texto libre que dijo la clienta (por ejemplo "masaje chino"). Omitilo para listar todos.',
        },
      },
    },
  };

  constructor(
    private readonly branchResolver: BranchResolver,
    private readonly listBranches: ListBranchesUseCase,
    private readonly listBranchServices: ListBranchServicesUseCase,
    private readonly listServices: ListServicesUseCase,
  ) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const query = optionalString(asObject(input), 'query');
    const catalog = await this.listServices.execute();
    const byId = new Map(catalog.map((service) => [service.id, service]));

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

    const branches = await this.listBranches.execute(true);
    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
    const branchIds = branchId ? [branchId] : branches.map((b) => b.id);

    const offersByBranch = await Promise.all(
      branchIds.map(async (id) => ({
        branchId: id,
        offers: await this.listBranchServices.execute(id, true),
      })),
    );

    type Listed = {
      id: string;
      name: string;
      durationMinutes: number;
      price: string | null;
      requiresDeposit: boolean;
      depositAmount: string | null;
      depositPercent: number | null;
      professionalIds: string[];
      branchNames: string[];
      keywords: string[];
      description: string | null;
      bookingQuestions: {
        id: string;
        prompt: string;
        kind: string;
        isRequired: boolean;
      }[];
    };

    const listed = new Map<string, Listed>();
    for (const { branchId: offerBranchId, offers } of offersByBranch) {
      const branchName = branchNameById.get(offerBranchId) ?? offerBranchId;
      for (const offer of offers) {
        const service = byId.get(offer.serviceId);
        if (!service || !service.isActive) continue;
        const effective = resolveEffectiveBranchService(service, offer);
        const existing = listed.get(service.id);
        if (existing) {
          if (!existing.branchNames.includes(branchName)) {
            existing.branchNames.push(branchName);
          }
          continue;
        }
        listed.set(service.id, {
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price: branchId ? effective.price.display() : null,
          requiresDeposit: service.requiresDeposit,
          depositAmount: branchId
            ? (effective.depositAmount?.display() ?? null)
            : null,
          depositPercent: service.depositPercent,
          professionalIds: service.professionalIds,
          branchNames: [branchName],
          keywords: service.keywords ?? [],
          description: service.description ?? null,
          bookingQuestions: service
            .activeBookingQuestions()
            .map((question) => ({
              id: question.id,
              prompt: question.prompt,
              kind: question.kind,
              isRequired: question.isRequired,
            })),
        });
      }
    }

    let services = [...listed.values()];
    if (query) {
      services = services
        .map((service) => ({
          service,
          score: scoreService(query, service),
        }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((row) => row.service);
    }

    return {
      status: 'success',
      summary: query
        ? services.length
          ? `${services.length} servicio(s) parecidos a "${query}".`
          : `Ningún servicio coincide con "${query}".`
        : `${services.length} servicios activos encontrados.`,
      data: services.map(
        ({ keywords: _k, description: _d, ...publicFields }) => publicFields,
      ),
      nextActions: services.length
        ? [
            query
              ? 'Si no hay match exacto, ofrecer el más parecido y preguntar si es eso.'
              : 'Elegir un servicio antes de buscar horarios.',
            'Si el servicio está en una sola sucursal, avisarlo. Si está en varias, buscar horarios en todas.',
          ]
        : [
            'No decir que el servicio no existe sin haber buscado: ofrecer los servicios activos o derivar.',
          ],
    };
  }
}
