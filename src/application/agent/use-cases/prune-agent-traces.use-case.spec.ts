import { AgentTraceRepository } from '@domain/agent/repositories/agent-trace.repository';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { ClockPort } from '@domain/common/ports/clock.port';
import { TenantContextPort } from '@domain/tenants/ports/tenant-context.port';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';

import { PruneAgentTracesUseCase } from './prune-agent-traces.use-case';

describe('PruneAgentTracesUseCase', () => {
  const tenantId = 'tenant-1';
  const now = new Date('2026-08-15T12:00:00.000Z');

  const traces: Pick<AgentTraceRepository, 'pruneOlderThan'> = {
    pruneOlderThan: jest.fn(),
  };
  const tenantContext: Pick<TenantContextPort, 'runWithTenant'> = {
    runWithTenant: jest.fn((_id, fn) => fn()),
  };
  const clock: Pick<ClockPort, 'now'> = {
    now: jest.fn(() => now),
  };
  const audit: Pick<AuditRecorder, 'record'> = {
    record: jest.fn(),
  };

  const useCase = new PruneAgentTracesUseCase(
    traces as AgentTraceRepository,
    tenantContext as TenantContextPort,
    clock as ClockPort,
    audit as AuditRecorder,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prunes inside the tenant context and records an audit entry', async () => {
    (traces.pruneOlderThan as jest.Mock).mockResolvedValue(3);

    await expect(
      useCase.execute({ tenantId, olderThanDays: 30 }),
    ).resolves.toEqual({
      deleted: 3,
      olderThanDays: 30,
      cutoff: '2026-07-16T12:00:00.000Z',
    });

    expect(tenantContext.runWithTenant).toHaveBeenCalledWith(
      tenantId,
      expect.any(Function),
    );
    expect(traces.pruneOlderThan).toHaveBeenCalledWith(
      new Date('2026-07-16T12:00:00.000Z'),
    );
    expect(audit.record).toHaveBeenCalledWith({
      action: AuditAction.AGENT_TRACES_PRUNED,
      entity: 'agent_trace',
      tenantId,
      after: {
        deleted: 3,
        olderThanDays: 30,
        cutoff: '2026-07-16T12:00:00.000Z',
      },
    });
  });
});
