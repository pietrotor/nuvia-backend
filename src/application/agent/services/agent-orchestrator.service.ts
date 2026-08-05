import { Inject, Injectable } from '@nestjs/common';

import { GetBusinessConfigUseCase } from '@application/business-config/use-cases/get-business-config.use-case';
import { LLM_PORT, LlmMessage, LlmPort } from '@domain/agent/ports/llm.port';
import { PromptChannel } from '@domain/agent/prompt/prompt-fragment';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  Message,
  MessageDirection,
} from '@domain/conversations/entities/message.entity';
import {
  TENANT_REPOSITORY,
  TenantRepository,
} from '@domain/tenants/repositories/tenant.repository';
import { AgentOutboundCopy } from '../messages/agent-outbound.copy';
import { toWhatsAppText } from '../messages/whatsapp-text';
import { AgentContext } from '../tools/agent-tool';
import { AgentPromptComposer } from './agent-prompt.composer';
import { AgentToolRegistry } from './agent-tool.registry';

const MAX_TOOL_ROUNDS = 5;
const FALLBACK_TIMEZONE = 'America/La_Paz';

export interface AgentResponse {
  text: string;
  // Which prompt produced this answer: stored with the outbound message.
  promptFingerprint: string;
}

@Injectable()
export class AgentOrchestrator {
  constructor(
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    private readonly getBusinessConfig: GetBusinessConfigUseCase,
    private readonly tools: AgentToolRegistry,
    @Inject(TENANT_REPOSITORY)
    private readonly tenants: TenantRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    private readonly promptComposer: AgentPromptComposer,
  ) {}

  async respond(
    history: Message[],
    context: AgentContext,
  ): Promise<AgentResponse> {
    const config = await this.getBusinessConfig.execute();
    const tenant = await this.tenants.findById(config.tenantId);
    const prompt = await this.promptComposer.compose({
      config,
      timezone: tenant?.timezone ?? FALLBACK_TIMEZONE,
      channel: PromptChannel.WHATSAPP,
      now: this.clock.now(),
    });
    const messages: LlmMessage[] = [
      { role: 'system', content: prompt.staticText, cacheable: true },
      { role: 'system', content: prompt.volatileText },
      ...history
        .filter((message) => message.content)
        .map<LlmMessage>((message) => ({
          role:
            message.direction === MessageDirection.INBOUND
              ? 'user'
              : 'assistant',
          content: message.content ?? '',
        })),
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const result = await this.llm.chat({
        messages,
        tools: this.tools.definitions(),
      });
      if (result.toolCalls.length === 0) {
        return {
          text: toWhatsAppText(
            result.content?.trim() || AgentOutboundCopy.incompleteConsultation,
          ),
          promptFingerprint: prompt.fingerprint,
        };
      }

      messages.push({
        role: 'assistant',
        content: result.content ?? '',
        toolCalls: result.toolCalls,
      });
      for (const call of result.toolCalls) {
        messages.push({
          role: 'tool',
          name: call.name,
          toolCallId: call.id,
          content: JSON.stringify(
            await this.executeTool(call.name, call.arguments, context),
          ),
        });
      }
    }

    return {
      text: AgentOutboundCopy.needsHumanContinuation,
      promptFingerprint: prompt.fingerprint,
    };
  }

  private async executeTool(
    name: string,
    rawArguments: string,
    context: AgentContext,
  ) {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        status: 'error',
        summary: `La herramienta ${name} no existe.`,
        nextActions: ['No repetir esta herramienta.'],
      };
    }

    try {
      return await tool.execute(JSON.parse(rawArguments), context);
    } catch {
      return {
        status: 'error',
        summary: 'No se pudo ejecutar la acción solicitada.',
        nextActions: [
          'Revisar los datos y reintentar una vez.',
          'Derivar si el error persiste.',
        ],
      };
    }
  }
}
