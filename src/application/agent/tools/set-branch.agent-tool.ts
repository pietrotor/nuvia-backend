import { Inject, Injectable } from '@nestjs/common';

import { BranchResolver } from '@application/branches/services/branch-resolver.service';
import { BranchNotFoundError } from '@domain/branches/exceptions/branch.exceptions';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, requiredUuid } from './tool-input';

@Injectable()
export class SetBranchAgentTool implements AgentTool {
  readonly definition = {
    name: 'set_branch',
    description:
      'Fija la sucursal de esta conversación luego de que la clienta elija una. Obligatorio antes de precios, horarios o reservas cuando hay más de una sucursal.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['branchId'],
      properties: {
        branchId: {
          type: 'string',
          description: 'UUID de la sucursal elegida (sale de list_branches)',
        },
      },
    },
  };

  constructor(
    private readonly branchResolver: BranchResolver,
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
  ) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const values = asObject(input);
    let branchId: string;
    try {
      branchId = requiredUuid(values, 'branchId');
    } catch {
      return {
        status: 'warning',
        summary:
          'No se fijó la sucursal: el identificador no es un UUID real. Copiá el id exacto de list_branches.',
        nextActions: ['Llamar a list_branches y usar un id de esa lista.'],
      };
    }

    let branch;
    try {
      branch = await this.branchResolver.resolve(branchId);
    } catch (error) {
      if (error instanceof BranchNotFoundError) {
        return {
          status: 'warning',
          summary: 'Esa sucursal no existe o no está activa.',
          nextActions: [
            'Llamar a list_branches y ofrecer solo las que aparecen ahí.',
          ],
        };
      }
      throw error;
    }

    await this.conversations.setBranch(context.conversationId, branch.id);
    // Same turn may call find_availability / list_services next: keep context in sync.
    context.branchId = branch.id;

    return {
      status: 'success',
      summary: `Sucursal fijada: ${branch.name}.`,
      data: {
        branchId: branch.id,
        name: branch.name,
        address: branch.address,
        mapsUrl: branch.mapsUrl,
      },
      nextActions: [
        'Ya se puede consultar precios, profesionales y horarios de esta sucursal.',
      ],
    };
  }
}
