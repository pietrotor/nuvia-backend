import { AgentTraceNotFoundError } from '@domain/agent/exceptions/agent-trace.exceptions';
import { AgentTrace } from '@domain/agent/entities/agent-trace.entity';
import { AgentTraceRepository } from '@domain/agent/repositories/agent-trace.repository';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import { TenantContextPort } from '@domain/tenants/ports/tenant-context.port';

import { AuditRecorder } from '@application/audit/services/audit-recorder.service';

import { GetAgentTraceUseCase } from './get-agent-trace.use-case';

describe('GetAgentTraceUseCase', () => {
  const tenantId = 'tenant-1';
  const traceId = 'trace-1';

  const trace = {
    id: traceId,
    conversationId: 'conv-1',
    outcome: 'answered',
  } as AgentTrace;

  const traces: Pick<AgentTraceRepository, 'findById'> = {
    findById: jest.fn(),
  };
  const tenantContext: Pick<TenantContextPort, 'runWithTenant'> = {
    runWithTenant: jest.fn((_id, fn) => fn()),
  };
  const audit: Pick<AuditRecorder, 'record'> = {
    record: jest.fn(),
  };

  const useCase = new GetAgentTraceUseCase(
    traces as AgentTraceRepository,
    tenantContext as TenantContextPort,
    audit as AuditRecorder,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the tenant context, loads the trace and audits the view', async () => {
    (traces.findById as jest.Mock).mockResolvedValue(trace);

    await expect(useCase.execute({ tenantId, traceId })).resolves.toBe(trace);

    expect(tenantContext.runWithTenant).toHaveBeenCalledWith(
      tenantId,
      expect.any(Function),
    );
    expect(traces.findById).toHaveBeenCalledWith(traceId);
    expect(audit.record).toHaveBeenCalledWith({
      action: AuditAction.AGENT_TRACE_VIEWED,
      entity: 'agent_trace',
      entityId: traceId,
      tenantId,
      after: {
        kind: 'detail',
        conversationId: 'conv-1',
        outcome: 'answered',
      },
    });
  });

  it('throws when the trace is missing in the tenant', async () => {
    (traces.findById as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute({ tenantId, traceId })).rejects.toBeInstanceOf(
      AgentTraceNotFoundError,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});
