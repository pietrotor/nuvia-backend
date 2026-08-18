import { Inject, Injectable } from '@nestjs/common';

import {
  AGENT_TRACE_VIEW_REPOSITORY,
  AgentTraceViewRepository,
} from '@domain/agent/repositories/agent-trace-view.repository';
import { AgentEconomicsSummary } from '@domain/agent/views/agent-economics-summary';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

export interface GetAgentEconomicsInput {
  tenantId: string;
  from: Date;
  to: Date;
}

@Injectable()
export class GetAgentEconomicsUseCase {
  constructor(
    @Inject(AGENT_TRACE_VIEW_REPOSITORY)
    private readonly traces: AgentTraceViewRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
  ) {}

  async execute(input: GetAgentEconomicsInput): Promise<AgentEconomicsSummary> {
    return this.tenantContext.runWithTenant(input.tenantId, () =>
      this.traces.summarizeEconomics({ from: input.from, to: input.to }),
    );
  }
}
