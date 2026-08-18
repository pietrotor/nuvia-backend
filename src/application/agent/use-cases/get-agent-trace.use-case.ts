import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AgentTrace } from '@domain/agent/entities/agent-trace.entity';
import { AgentTraceNotFoundError } from '@domain/agent/exceptions/agent-trace.exceptions';
import {
  AGENT_TRACE_REPOSITORY,
  AgentTraceRepository,
} from '@domain/agent/repositories/agent-trace.repository';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

@Injectable()
export class GetAgentTraceUseCase {
  constructor(
    @Inject(AGENT_TRACE_REPOSITORY)
    private readonly traces: AgentTraceRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: {
    tenantId: string;
    traceId: string;
  }): Promise<AgentTrace> {
    return this.tenantContext.runWithTenant(input.tenantId, async () => {
      const trace = await this.traces.findById(input.traceId);
      if (!trace) throw new AgentTraceNotFoundError(input.traceId);

      await this.audit.record({
        action: AuditAction.AGENT_TRACE_VIEWED,
        entity: 'agent_trace',
        entityId: trace.id,
        tenantId: input.tenantId,
        after: {
          kind: 'detail',
          conversationId: trace.conversationId,
          outcome: trace.outcome,
        },
      });

      return trace;
    });
  }
}
