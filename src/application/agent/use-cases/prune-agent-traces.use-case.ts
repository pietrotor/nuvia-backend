import { Inject, Injectable } from '@nestjs/common';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import {
  AGENT_TRACE_REPOSITORY,
  AgentTraceRepository,
} from '@domain/agent/repositories/agent-trace.repository';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { CLOCK_PORT, ClockPort } from '@domain/common/ports/clock.port';
import {
  TENANT_CONTEXT_PORT,
  TenantContextPort,
} from '@domain/tenants/ports/tenant-context.port';

export interface PruneAgentTracesResult {
  deleted: number;
  olderThanDays: number;
  cutoff: string;
}

/**
 * Ops retention for agent debug timelines. Traces are telemetry, not business records:
 * hard-delete past the retention window is intentional (exception to soft-state-only).
 */
@Injectable()
export class PruneAgentTracesUseCase {
  constructor(
    @Inject(AGENT_TRACE_REPOSITORY)
    private readonly traces: AgentTraceRepository,
    @Inject(TENANT_CONTEXT_PORT)
    private readonly tenantContext: TenantContextPort,
    @Inject(CLOCK_PORT)
    private readonly clock: ClockPort,
    private readonly audit: AuditRecorder,
  ) {}

  async execute(input: {
    tenantId: string;
    olderThanDays: number;
  }): Promise<PruneAgentTracesResult> {
    return this.tenantContext.runWithTenant(input.tenantId, async () => {
      const cutoff = new Date(
        this.clock.now().getTime() - input.olderThanDays * 24 * 60 * 60 * 1000,
      );
      const deleted = await this.traces.pruneOlderThan(cutoff);

      await this.audit.record({
        action: AuditAction.AGENT_TRACES_PRUNED,
        entity: 'agent_trace',
        tenantId: input.tenantId,
        after: {
          deleted,
          olderThanDays: input.olderThanDays,
          cutoff: cutoff.toISOString(),
        },
      });

      return {
        deleted,
        olderThanDays: input.olderThanDays,
        cutoff: cutoff.toISOString(),
      };
    });
  }
}
