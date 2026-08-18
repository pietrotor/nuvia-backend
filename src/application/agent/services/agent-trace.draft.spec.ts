import { AgentTraceDraft } from './agent-trace.draft';

describe('AgentTraceDraft', () => {
  const startedAt = new Date('2026-08-15T12:00:00.000Z');

  it('records llm and tool steps and finishes with an outcome', () => {
    const draft = new AgentTraceDraft({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      triggerProviderMessageId: 'wamid.in',
      inboundText: 'Hola',
      startedAt,
      maxStepChars: 100,
    });

    draft.setPrompt({
      staticText: 'static',
      volatileText: 'volatile',
      fingerprint: 'fp',
    });
    draft.recordLlmRequest({
      round: 0,
      phase: 'initial',
      toolChoice: 'auto',
      messages: [
        { role: 'system', content: 'ignored' },
        { role: 'user', content: 'Hola' },
      ],
    });
    draft.recordLlmResponse({
      round: 0,
      phase: 'initial',
      content: null,
      toolCalls: [{ id: '1', name: 'list_services', arguments: '{}' }],
      latencyMs: 12,
      model: 'test-model',
      usage: {
        promptTokens: 10,
        completionTokens: 4,
        cachedPromptTokens: 3,
        cacheWriteTokens: 2,
        costCredits: 0.001,
      },
      finishReason: 'tool_calls',
    });
    draft.recordToolCall({
      round: 0,
      name: 'list_services',
      arguments: '{}',
      status: 'success',
      summary: 'ok',
      data: { services: 1 },
      latencyMs: 3,
    });
    draft.setPendingOutcome('answered');

    const trace = draft.finish({
      text: 'Tenemos limpieza facial.',
      endedAt: new Date('2026-08-15T12:00:01.000Z'),
    });

    expect(trace.outcome).toBe('answered');
    expect(trace.rounds).toBe(1);
    expect(trace.toolCalls).toBe(1);
    expect(trace.llmCalls).toBe(1);
    expect(trace.promptTokensTotal).toBe(10);
    expect(trace.completionTokensTotal).toBe(4);
    expect(trace.cachedPromptTokensTotal).toBe(3);
    expect(trace.cacheWriteTokensTotal).toBe(2);
    expect(trace.costCreditsTotal).toBe(0.001);
    expect(trace.staticPrompt).toBe('static');
    expect(trace.steps.map((step) => step.type)).toEqual([
      'llm_request',
      'llm_response',
      'tool_call',
      'outcome',
    ]);
    expect(trace.durationMs).toBe(1000);
  });

  it('truncates oversized payloads', () => {
    const draft = new AgentTraceDraft({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      triggerProviderMessageId: 'wamid.in',
      inboundText: null,
      startedAt,
      maxStepChars: 20,
    });

    draft.recordToolCall({
      round: 0,
      name: 'find_availability',
      arguments: '{"day":"2026-08-20","serviceId":"very-long-value"}',
      status: 'success',
      summary: 'slots',
      data: { slots: 'a'.repeat(50) },
      latencyMs: 1,
    });

    const trace = draft.finish({ text: 'ok', endedAt: startedAt });
    const tool = trace.steps.find((step) => step.type === 'tool_call');
    expect(tool?.type).toBe('tool_call');
    if (tool?.type === 'tool_call') {
      expect(tool.truncated).toBe(true);
      expect(String(tool.arguments).endsWith('…')).toBe(true);
    }
  });

  it('builds a skipped trace without a loop', () => {
    const trace = AgentTraceDraft.skipped({
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      triggerProviderMessageId: 'wamid.in',
      inboundText: 'Hola',
      reason: 'skipped_paused',
      startedAt,
    });

    expect(trace.outcome).toBe('skipped_paused');
    expect(trace.rounds).toBe(0);
    expect(trace.steps.at(-1)).toEqual({
      type: 'outcome',
      text: '',
      reason: 'skipped_paused',
    });
  });
});
