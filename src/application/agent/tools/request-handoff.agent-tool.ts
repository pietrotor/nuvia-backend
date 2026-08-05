import { Inject, Injectable } from '@nestjs/common';

import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
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
  ) {}

  async execute(
    input: unknown,
    context: AgentContext,
  ): Promise<AgentToolResult> {
    const reason = requiredString(asObject(input), 'reason');
    await this.conversations.setHandoff(context.conversationId, reason);
    return {
      status: 'success',
      summary: 'Conversación derivada a una persona.',
      nextActions: ['Avisar que el equipo continuará la conversación.'],
    };
  }
}
