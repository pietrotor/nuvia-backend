import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import {
  AGENT_TRACE_VIEW_REPOSITORY,
  AgentTraceViewRepository,
} from '@domain/agent/repositories/agent-trace-view.repository';
import { AgentTraceSummary } from '@domain/agent/views/agent-trace-summary';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { ConversationNotFoundError } from '@domain/conversations/exceptions/conversation.exceptions';
import { Message } from '@domain/conversations/entities/message.entity';
import {
  CONVERSATION_REPOSITORY,
  ConversationRepository,
} from '@domain/conversations/repositories/conversation.repository';
import {
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '@domain/conversations/repositories/message.repository';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

/** Hard cap for the admin debugger; long threads stay readable without pagination. */
const THREAD_MESSAGE_LIMIT = 200;

export interface ConversationTraceThread {
  messages: Message[];
  traces: AgentTraceSummary[];
}

@Injectable()
export class GetConversationTraceThreadUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly conversations: ConversationRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messages: MessageRepository,
    @Inject(AGENT_TRACE_VIEW_REPOSITORY)
    private readonly traces: AgentTraceViewRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: {
    tenantId: string;
    conversationId: string;
  }): Promise<ConversationTraceThread> {
    return this.tenantContext.runWithTenant(input.tenantId, async () => {
      const conversation = await this.conversations.findById(
        input.conversationId,
      );
      if (!conversation) {
        throw new ConversationNotFoundError(input.conversationId);
      }

      const [messages, traces] = await Promise.all([
        this.messages.findByConversation(input.conversationId, {
          limit: THREAD_MESSAGE_LIMIT,
          offset: 0,
        }),
        this.traces.listByConversation(input.conversationId),
      ]);

      await this.audit.record({
        action: AuditAction.AGENT_TRACE_VIEWED,
        entity: 'conversation',
        entityId: input.conversationId,
        tenantId: input.tenantId,
        after: { kind: 'thread', traceCount: traces.length },
      });

      return { messages, traces };
    });
  }
}
