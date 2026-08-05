import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  AgentTone,
  BusinessConfig,
  DEFAULT_AGENT_POLICY,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { Client } from '@domain/clients/entities/client.entity';
import { ClientRepository } from '@domain/clients/repositories/client.repository';
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
import { MessagingPort } from '@domain/messaging/ports/messaging.port';
import { AgentOutboundCopy } from '../messages/agent-outbound.copy';
import { AgentOrchestrator } from '../services/agent-orchestrator.service';
import { ProcessInboundMessageUseCase } from './process-inbound-message.use-case';

const now = new Date('2026-08-04T15:00:00.000Z');
const emptyHours = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
  sun: null,
};

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
    businessHours: emptyHours,
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

describe('ProcessInboundMessageUseCase', () => {
  let clients: jest.Mocked<Pick<ClientRepository, 'findOrCreate'>>;
  let conversations: jest.Mocked<
    Pick<ConversationRepository, 'findOrCreate' | 'resumeBot'>
  >;
  let messages: jest.Mocked<
    Pick<MessageRepository, 'recordIfNew' | 'hasReplyTo' | 'findRecent'>
  >;
  let businessConfigs: jest.Mocked<
    Pick<BusinessConfigRepository, 'findByTenant'>
  >;
  let messaging: jest.Mocked<Pick<MessagingPort, 'sendText'>>;
  let orchestrator: jest.Mocked<Pick<AgentOrchestrator, 'respond'>>;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let useCase: ProcessInboundMessageUseCase;

  beforeEach(() => {
    clients = {
      findOrCreate: jest.fn().mockResolvedValue(
        new Client({
          id: 'c1',
          tenantId: 't1',
          name: 'Ana',
          phoneE164: '+59170000001',
          notes: null,
        }),
      ),
    };
    conversations = {
      findOrCreate: jest.fn().mockResolvedValue(buildConversation()),
      resumeBot: jest.fn().mockResolvedValue(buildConversation()),
    };
    messages = {
      recordIfNew: jest.fn().mockResolvedValue(
        new Message({
          id: 'm-in',
          tenantId: 't1',
          conversationId: 'cv1',
          providerMessageId: 'wamid.in',
          direction: MessageDirection.INBOUND,
          kind: MessageKind.TEXT,
          content: 'Hola',
          inReplyToProviderMessageId: null,
          occurredAt: now,
        }),
      ),
      hasReplyTo: jest.fn().mockResolvedValue(false),
      findRecent: jest.fn().mockResolvedValue([]),
    };
    businessConfigs = {
      findByTenant: jest.fn().mockResolvedValue(buildConfig()),
    };
    messaging = {
      sendText: jest
        .fn()
        .mockResolvedValueOnce({ providerMessageId: 'wamid.out.1' })
        .mockResolvedValue({ providerMessageId: 'wamid.out.2' }),
    };
    orchestrator = {
      respond: jest.fn().mockResolvedValue({
        text: 'Claro, ¿en qué te ayudo?',
        promptFingerprint: 'rev1.esthetics.abcd1234',
      }),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const clock: ClockPort = { now: () => now };

    useCase = new ProcessInboundMessageUseCase(
      clients as unknown as ClientRepository,
      conversations as unknown as ConversationRepository,
      messages as unknown as MessageRepository,
      businessConfigs as unknown as BusinessConfigRepository,
      messaging as unknown as MessagingPort,
      clock,
      orchestrator as unknown as AgentOrchestrator,
      audit as unknown as AuditRecorder,
    );
  });

  const input = {
    tenantId: 't1',
    providerMessageId: 'wamid.in',
    clientPhoneE164: '+59170000001',
    clientName: 'Ana',
    kind: MessageKind.TEXT,
    content: 'Hola',
    occurredAt: now,
  };

  it('does not call the LLM while paused inside the timeout window', async () => {
    conversations.findOrCreate.mockResolvedValue(
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
  });

  it('auto-resumes after timeout, sends a bridge, then answers with the agent', async () => {
    conversations.findOrCreate.mockResolvedValue(
      buildConversation({
        botPaused: true,
        botPausedAt: new Date('2026-08-04T13:00:00.000Z'),
        handoffReason: 'Quiere hablar con alguien',
      }),
    );

    await useCase.execute(input);

    expect(conversations.resumeBot).toHaveBeenCalledWith('cv1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CONVERSATION_BOT_RESUMED,
        after: { reason: 'auto_timeout' },
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
    await useCase.execute({ ...input, kind: MessageKind.AUDIO, content: null });

    expect(orchestrator.respond).not.toHaveBeenCalled();
    expect(messages.recordIfNew).toHaveBeenLastCalledWith(
      expect.objectContaining({
        direction: MessageDirection.OUTBOUND,
        promptFingerprint: null,
      }),
    );
  });

  it('never auto-resumes when the tenant disables it with 0 minutes', async () => {
    businessConfigs.findByTenant.mockResolvedValue(buildConfig(0));
    conversations.findOrCreate.mockResolvedValue(
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
});
