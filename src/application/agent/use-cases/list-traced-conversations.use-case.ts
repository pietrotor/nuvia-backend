import { Inject, Injectable } from '@nestjs/common';

import {
  AGENT_TRACE_VIEW_REPOSITORY,
  AgentTraceViewRepository,
} from '@domain/agent/repositories/agent-trace-view.repository';
import { AgentTracedConversationListResult } from '@domain/agent/views/agent-traced-conversation-view';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

@Injectable()
export class ListTracedConversationsUseCase {
  constructor(
    @Inject(AGENT_TRACE_VIEW_REPOSITORY)
    private readonly traces: AgentTraceViewRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
  ) {}

  async execute(input: {
    tenantId: string;
    limit: number;
    offset: number;
    search?: string;
  }): Promise<AgentTracedConversationListResult> {
    return this.tenantContext.runWithTenant(input.tenantId, () =>
      this.traces.listConversations({
        limit: input.limit,
        offset: input.offset,
        search: input.search,
      }),
    );
  }
}
