import { Inject, Injectable } from '@nestjs/common';

import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import { ConversationHandoffLabelService } from '@application/conversations/services/conversation-handoff-label.service';
import { AgentContext, AgentTool, AgentToolResult } from './agent-tool';
import { asObject, requiredString } from './tool-input';

@Injectable()
export class RequestHandoffAgentTool implements AgentTool {
  readonly definition = {
    name: 'request_handoff',
    description:
      'Pausa el bot y deriva a una persona ante solicitud, reclamo, urgencia o consulta médica.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['reason'],
      properties: { reason: { type: 'string' } },
    },
  };

  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    private readonly handoffLabel: ConversationHandoffLabelService,
  ) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const reason = requiredString(asObject(input), 'reason');
    const conversation = await this.conversations.setHandoff(
      context.conversationId,
      reason,
    );
    if (!conversation) {
      return {
        status: 'error',
        summary: 'No se pudo derivar la conversación.',
        nextActions: [
          'Reintentar una vez o avisar que el equipo revisará el chat.',
        ],
      };
    }
    await this.handoffLabel.markAttention(conversation);
    return {
      status: 'success',
      summary: 'Conversación derivada a una persona.',
      committedAction: {
        operation: 'conversation.handoff',
        resourceType: 'conversation',
        resourceId: conversation.id,
        outcome: 'committed',
      },
      nextActions: ['Avisar que el equipo continuará la conversación.'],
    };
  }
}
