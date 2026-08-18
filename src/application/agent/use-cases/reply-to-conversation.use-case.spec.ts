import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  AgentTone,
  BusinessConfig,
  DEFAULT_AGENT_POLICY,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { ClockPort } from '@domain/common/ports/clock.port';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Conversation } from '@domain/conversations/entities/conversation.entity';
import {
  Message,
  MessageDirection,
  MessageKind,
} from '@domain/conversations/entities/message.entity';
import { ConversationRepository } from '@domain/conversations/repositories/conversation.repository';
import { MessageRepository } from '@domain/conversations/repositories/message.repository';
import { LoggerPort } from '@domain/common/ports/logger.port';
import { MessagingPort } from '@domain/messaging/ports/messaging.port';
import { TYPING_CHUNKING_THRESHOLD_MS } from '@domain/messaging/services/human-pacing';
import { TenantRepository } from '@domain/tenants/repositories/tenant.repository';
import { SendDepositQrUseCase } from '@application/deposits/use-cases/send-deposit-qr.use-case';
import { PlanEntitlements } from '@application/subscriptions/services/plan-entitlements.service';
import { ConversationHandoffLabelService } from '@application/conversations/services/conversation-handoff-label.service';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import { AgentOutboundCopy } from '../messages/agent-outbound.copy';
import { AgentOrchestrator } from '../services/agent-orchestrator.service';
import { ReplyToConversationUseCase } from './reply-to-conversation.use-case';

const now = new Date('2026-08-04T15:00:00.000Z');

function buildConfig(
  handoffAutoResumeMinutes = DEFAULT_AGENT_POLICY.handoffAutoResumeMinutes,
): BusinessConfig {
  return new BusinessConfig({
    id: 'bc1',
    tenantId: 't1',
    slug: 'estetica-glow',
    agentName: 'Vale',
    tone: AgentTone.WARM,
    currency: Currency.BOB,
    bookingPolicy: {
      minLeadTimeHours: 2,
      cancelRescheduleHours: 24,
      noShowMessage: 'Avisanos.',
    },
    agentPolicy: { handoffAutoResumeMinutes },
    faq: {},
  });
}

function buildConversation(
  overrides: Partial<ConstructorParameters<typeof Conversation>[0]> = {},
): Conversation {
  return new Conversation({
    id: 'cv1',
    tenantId: 't1',
    clientId: 'c1',
    clientPhoneE164: '+59170000001',
    botPaused: false,
    botPausedAt: null,
    handoffReason: null,
    lastActivityAt: now,
    ...overrides,
  });
}

function buildInbound(
  overrides: Partial<ConstructorParameters<typeof Message>[0]> = {},
): Message {
  return new Message({
    id: 'm-in',
    tenantId: 't1',
    conversationId: 'cv1',
    providerMessageId: 'wamid.in',
    direction: MessageDirection.INBOUND,
    kind: MessageKind.TEXT,
    content: 'Hola',
    inReplyToProviderMessageId: null,
    occurredAt: now,
    ...overrides,
  });
}

describe('ReplyToConversationUseCase', () => {
  let conversations: jest.Mocked<
    Pick<ConversationRepository, 'findById' | 'resumeBot' | 'setHandoff'>
  >;
  let messages: jest.Mocked<
    Pick<MessageRepository, 'recordIfNew' | 'hasReplyTo' | 'findRecent'>
  >;
  let businessConfigs: jest.Mocked<
    Pick<BusinessConfigRepository, 'findByTenant'>
  >;
  let messaging: jest.Mocked<
    Pick<MessagingPort, 'sendText' | 'markAsRead' | 'showTyping'>
  >;
  let orchestrator: jest.Mocked<Pick<AgentOrchestrator, 'respond'>>;
  let sendDepositQr: jest.Mocked<Pick<SendDepositQrUseCase, 'execute'>>;
  let logger: jest.Mocked<LoggerPort>;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let entitlements: jest.Mocked<Pick<PlanEntitlements, 'agentAccess'>>;
  let handoffLabel: jest.Mocked<
    Pick<ConversationHandoffLabelService, 'markAttention' | 'clearAttention'>
  >;
  let useCase: ReplyToConversationUseCase;

  beforeEach(() => {
    handoffLabel = {
      markAttention: jest.fn().mockResolvedValue(undefined),
      clearAttention: jest.fn().mockResolvedValue(undefined),
    };
    conversations = {
      findById: jest.fn().mockResolvedValue(buildConversation()),
      resumeBot: jest.fn().mockResolvedValue(buildConversation()),
      setHandoff: jest.fn().mockResolvedValue(buildConversation()),
    };
    messages = {
      recordIfNew: jest.fn().mockResolvedValue(buildInbound()),
      hasReplyTo: jest.fn().mockResolvedValue(false),
      findRecent: jest.fn().mockResolvedValue([buildInbound()]),
    };
    businessConfigs = {
      findByTenant: jest.fn().mockResolvedValue(buildConfig()),
    };
    messaging = {
      sendText: jest
        .fn()
        .mockResolvedValueOnce({ providerMessageId: 'wamid.out.1' })
        .mockResolvedValue({ providerMessageId: 'wamid.out.2' }),
      markAsRead: jest.fn().mockResolvedValue(undefined),
      showTyping: jest.fn().mockResolvedValue(undefined),
    };
    orchestrator = {
      respond: jest.fn().mockResolvedValue({
        text: 'Claro, ¿en qué te ayudo?',
        promptFingerprint: 'rev1.esthetics.abcd1234',
        followUps: [],
      }),
    };
    sendDepositQr = {
      execute: jest
        .fn()
        .mockResolvedValue({ outcome: 'sent', amount: 'Bs 75' }),
    };
    logger = { error: jest.fn(), warn: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    entitlements = {
      agentAccess: jest.fn().mockResolvedValue({
        allowed: true,
        reason: null,
        limit: 500,
        used: 10,
      }),
    };
    const clock: ClockPort = { now: () => now };
    const tenants = {
      findById: jest.fn().mockResolvedValue({ timezone: 'America/La_Paz' }),
    };

    useCase = new ReplyToConversationUseCase(
      conversations as unknown as ConversationRepository,
      messages as unknown as MessageRepository,
      businessConfigs as unknown as BusinessConfigRepository,
      tenants as unknown as TenantRepository,
      messaging as unknown as MessagingPort,
      clock,
      logger,
      orchestrator as unknown as AgentOrchestrator,
      sendDepositQr as unknown as SendDepositQrUseCase,
      audit as unknown as AuditRecorder,
      entitlements as unknown as PlanEntitlements,
      { save: jest.fn().mockResolvedValue(undefined) } as never,
      {
        get: jest.fn((key: string, fallback?: string) => {
          if (key === 'LLM_SHORT_CIRCUIT_GREETINGS') return 'false';
          return fallback ?? 'true';
        }),
      } as never,
      handoffLabel as unknown as ConversationHandoffLabelService,
    );
  });

  const input = {
    tenantId: 't1',
    conversationId: 'cv1',
    clientId: 'c1',
    clientPhoneE164: '+59170000001',
    providerMessageId: 'wamid.in',
  };

  it('answers once for a burst, from the job queued for the last message', async () => {
    messages.findRecent.mockResolvedValue([
      buildInbound(),
      buildInbound({ id: 'm-in-2', providerMessageId: 'wamid.in.2' }),
    ]);

    await useCase.execute(input);

    expect(orchestrator.respond).not.toHaveBeenCalled();
    expect(messaging.sendText).not.toHaveBeenCalled();
    expect(messaging.markAsRead).not.toHaveBeenCalled();
  });

  it('short-circuits a pure greeting without calling the LLM', async () => {
    useCase = new ReplyToConversationUseCase(
      conversations as unknown as ConversationRepository,
      messages as unknown as MessageRepository,
      businessConfigs as unknown as BusinessConfigRepository,
      {
        findById: jest.fn().mockResolvedValue({ timezone: 'America/La_Paz' }),
      } as unknown as TenantRepository,
      messaging as unknown as MessagingPort,
      { now: () => now },
      logger,
      orchestrator as unknown as AgentOrchestrator,
      sendDepositQr as unknown as SendDepositQrUseCase,
      audit as unknown as AuditRecorder,
      entitlements as unknown as PlanEntitlements,
      { save: jest.fn().mockResolvedValue(undefined) } as never,
      {
        get: jest.fn((key: string, fallback?: string) => {
          if (key === 'LLM_SHORT_CIRCUIT_GREETINGS') return 'true';
          return fallback ?? 'true';
        }),
      } as never,
      handoffLabel as unknown as ConversationHandoffLabelService,
    );

    await useCase.execute(input);

    expect(orchestrator.respond).not.toHaveBeenCalled();
    expect(messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Vale'),
      }),
    );
  });

  it('still uses the LLM for a greeting that already carries a request', async () => {
    useCase = new ReplyToConversationUseCase(
      conversations as unknown as ConversationRepository,
      messages as unknown as MessageRepository,
      businessConfigs as unknown as BusinessConfigRepository,
      {
        findById: jest.fn().mockResolvedValue({ timezone: 'America/La_Paz' }),
      } as unknown as TenantRepository,
      messaging as unknown as MessagingPort,
      { now: () => now },
      logger,
      orchestrator as unknown as AgentOrchestrator,
      sendDepositQr as unknown as SendDepositQrUseCase,
      audit as unknown as AuditRecorder,
      entitlements as unknown as PlanEntitlements,
      { save: jest.fn().mockResolvedValue(undefined) } as never,
      {
        get: jest.fn((key: string, fallback?: string) => {
          if (key === 'LLM_SHORT_CIRCUIT_GREETINGS') return 'true';
          return fallback ?? 'true';
        }),
      } as never,
      handoffLabel as unknown as ConversationHandoffLabelService,
    );
    messages.findRecent.mockResolvedValue([
      buildInbound({ content: 'hola, quiero manicure' }),
    ]);

    await useCase.execute(input);

    expect(orchestrator.respond).toHaveBeenCalled();
  });

  it('does not answer a message that was already answered', async () => {
    messages.hasReplyTo.mockResolvedValue(true);

    await useCase.execute(input);

    expect(orchestrator.respond).not.toHaveBeenCalled();
    expect(messaging.sendText).not.toHaveBeenCalled();
  });

  it('turns the message blue and starts typing before it thinks', async () => {
    await useCase.execute(input);

    expect(messaging.markAsRead).toHaveBeenCalledWith({
      tenantId: 't1',
      toE164: '+59170000001',
      providerMessageId: 'wamid.in',
    });
    expect(messaging.showTyping).toHaveBeenCalledWith(
      expect.objectContaining({ toE164: '+59170000001' }),
    );
    expect(messaging.markAsRead.mock.invocationCallOrder[0]).toBeLessThan(
      orchestrator.respond.mock.invocationCallOrder[0],
    );
  });

  it('holds the answer back so it does not land instantly', async () => {
    await useCase.execute(input);

    expect(messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        typingDelayMs: expect.any(Number) as number,
      }),
    );
    const [sent] = messaging.sendText.mock.calls[0];
    expect(sent.typingDelayMs).toBeGreaterThan(0);
    expect(sent.typingDelayMs).toBeLessThan(TYPING_CHUNKING_THRESHOLD_MS);
  });

  it('still answers when the provider refuses the read receipt', async () => {
    messaging.markAsRead.mockRejectedValue(new Error('lid contact'));

    await useCase.execute(input);

    expect(messaging.sendText).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('does not call the LLM while paused inside the timeout window', async () => {
    conversations.findById.mockResolvedValue(
      buildConversation({
        botPaused: true,
        botPausedAt: new Date('2026-08-04T14:30:00.000Z'),
        handoffReason: 'Quiere hablar con alguien',
      }),
    );

    await useCase.execute(input);

    expect(orchestrator.respond).not.toHaveBeenCalled();
    expect(messaging.sendText).not.toHaveBeenCalled();
    expect(conversations.resumeBot).not.toHaveBeenCalled();
    // Nobody read it yet: the owner is the one being waited on.
    expect(messaging.markAsRead).not.toHaveBeenCalled();
  });

  it('auto-resumes after timeout, sends a bridge, then answers with the agent', async () => {
    conversations.findById.mockResolvedValue(
      buildConversation({
        botPaused: true,
        botPausedAt: new Date('2026-08-04T13:00:00.000Z'),
        handoffReason: 'Quiere hablar con alguien',
      }),
    );

    await useCase.execute(input);

    expect(conversations.resumeBot).toHaveBeenCalledWith('cv1');
    expect(handoffLabel.clearAttention).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CONVERSATION_BOT_RESUMED,
        after: { reason: 'auto_timeout', source: 'auto_timeout' },
      }),
    );
    expect(messaging.sendText).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        text: AgentOutboundCopy.handoffAutoResumeBridge('Vale'),
      }),
    );
    expect(orchestrator.respond).toHaveBeenCalled();
    expect(messaging.sendText).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ text: 'Claro, ¿en qué te ayudo?' }),
    );
    // Only the answer counts as the reply, so a retried job knows it is done.
    expect(messages.recordIfNew).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ inReplyToProviderMessageId: null }),
    );
    expect(messages.recordIfNew).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ inReplyToProviderMessageId: 'wamid.in' }),
    );
  });

  it('stores which prompt produced the answer it sent', async () => {
    await useCase.execute(input);

    expect(messages.recordIfNew).toHaveBeenLastCalledWith(
      expect.objectContaining({
        direction: MessageDirection.OUTBOUND,
        promptFingerprint: 'rev1.esthetics.abcd1234',
      }),
    );
  });

  it('leaves no fingerprint when the agent never ran', async () => {
    messages.findRecent.mockResolvedValue([
      buildInbound({ kind: MessageKind.AUDIO, content: null }),
    ]);

    await useCase.execute(input);

    expect(orchestrator.respond).not.toHaveBeenCalled();
    expect(messages.recordIfNew).toHaveBeenLastCalledWith(
      expect.objectContaining({
        direction: MessageDirection.OUTBOUND,
        promptFingerprint: null,
      }),
    );
  });

  it('sends the deposit QR after the answer that announced it', async () => {
    orchestrator.respond.mockResolvedValue({
      text: 'Listo, te agendé. Te mando el QR de la seña.',
      promptFingerprint: 'rev1.esthetics.abcd1234',
      followUps: [{ kind: 'deposit_qr', appointmentId: 'ap1' }],
    });

    await useCase.execute(input);

    expect(messaging.sendText).toHaveBeenCalledTimes(1);
    expect(sendDepositQr.execute).toHaveBeenCalledWith({
      appointmentId: 'ap1',
      conversationId: 'cv1',
      clientPhoneE164: '+59170000001',
    });
    // The announcement leaves before the image, so the client reads them in order.
    expect(messaging.sendText.mock.invocationCallOrder[0]).toBeLessThan(
      sendDepositQr.execute.mock.invocationCallOrder[0],
    );
  });

  it('keeps the answer sent when the deposit QR cannot go out', async () => {
    orchestrator.respond.mockResolvedValue({
      text: 'Listo, te agendé.',
      promptFingerprint: 'rev1.esthetics.abcd1234',
      followUps: [{ kind: 'deposit_qr', appointmentId: 'ap1' }],
    });
    sendDepositQr.execute.mockRejectedValue(new Error('storage down'));

    await expect(useCase.execute(input)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });

  it('never auto-resumes when the tenant disables it with 0 minutes', async () => {
    businessConfigs.findByTenant.mockResolvedValue(buildConfig(0));
    conversations.findById.mockResolvedValue(
      buildConversation({
        botPaused: true,
        botPausedAt: new Date('2026-08-01T00:00:00.000Z'),
        handoffReason: 'Quiere hablar con alguien',
      }),
    );

    await useCase.execute(input);

    expect(conversations.resumeBot).not.toHaveBeenCalled();
    expect(orchestrator.respond).not.toHaveBeenCalled();
    expect(messaging.sendText).not.toHaveBeenCalled();
  });

  it('pauses the bot without answering when the subscription blocks the agent', async () => {
    entitlements.agentAccess.mockResolvedValue({
      allowed: false,
      reason: 'quota_exhausted',
      limit: 200,
      used: 200,
    });

    await useCase.execute(input);

    expect(conversations.setHandoff).toHaveBeenCalledWith(
      'cv1',
      'subscription_limit',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.AGENT_PAUSED_BY_QUOTA,
      }),
    );
    expect(orchestrator.respond).not.toHaveBeenCalled();
    expect(messaging.sendText).not.toHaveBeenCalled();
    expect(messaging.markAsRead).not.toHaveBeenCalled();
    expect(conversations.resumeBot).not.toHaveBeenCalled();
  });

  it('hands off and answers once when the LLM provider fails', async () => {
    orchestrator.respond.mockRejectedValue(
      new InternalError(ErrorCode.LLM_PROVIDER_ERROR, {
        status: 502,
        error_type: 'provider_unavailable',
        model: 'anthropic/claude-haiku-4.5',
      }),
    );

    await expect(useCase.execute(input)).resolves.toBeUndefined();

    expect(conversations.setHandoff).toHaveBeenCalledWith(
      'cv1',
      'llm_provider_error',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CONVERSATION_BOT_PAUSED,
        after: {
          reason: 'llm_provider_error',
          code: ErrorCode.LLM_PROVIDER_ERROR,
        },
      }),
    );
    expect(messaging.sendText).toHaveBeenCalledTimes(1);
    expect(messaging.sendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: AgentOutboundCopy.llmUnavailable }),
    );
    expect(messages.recordIfNew).toHaveBeenCalledWith(
      expect.objectContaining({
        inReplyToProviderMessageId: 'wamid.in',
        promptFingerprint: null,
      }),
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('rethrows non-LLM failures so BullMQ can retry them', async () => {
    orchestrator.respond.mockRejectedValue(new Error('database down'));

    await expect(useCase.execute(input)).rejects.toThrow('database down');
    expect(conversations.setHandoff).not.toHaveBeenCalled();
    expect(messaging.sendText).not.toHaveBeenCalled();
  });
});
