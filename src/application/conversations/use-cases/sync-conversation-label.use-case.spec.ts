import { AuditRecorder } from '@application/audit/services/audit-recorder.service';
import { AuditAction } from '@domain/audit/entities/audit-log.entity';
import {
  AgentTone,
  BusinessConfig,
  DEFAULT_AGENT_POLICY,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { LoggerPort } from '@domain/common/ports/logger.port';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Conversation } from '@domain/conversations/entities/conversation.entity';
import { ConversationRepository } from '@domain/conversations/repositories/conversation.repository';
import { SyncConversationLabelUseCase } from './sync-conversation-label.use-case';

const LABEL_ID = 'label-42';

function buildConfig(
  overrides: {
    humanAttentionLabelSync?: boolean;
    evolutionHumanLabelId?: string | null;
  } = {},
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
    agentPolicy: {
      ...DEFAULT_AGENT_POLICY,
      humanAttentionLabelSync: overrides.humanAttentionLabelSync ?? true,
    },
    faq: {},
    evolutionHumanLabelId:
      overrides.evolutionHumanLabelId === undefined
        ? LABEL_ID
        : overrides.evolutionHumanLabelId,
  });
}

function buildConversation(botPaused: boolean): Conversation {
  return new Conversation({
    id: 'cv1',
    tenantId: 't1',
    clientId: 'c1',
    clientPhoneE164: '+59170000001',
    botPaused,
    botPausedAt: botPaused ? new Date() : null,
    handoffReason: null,
    lastActivityAt: new Date(),
  });
}

describe('SyncConversationLabelUseCase', () => {
  let conversations: jest.Mocked<
    Pick<ConversationRepository, 'findByClientPhone' | 'pauseBot' | 'resumeBot'>
  >;
  let businessConfigs: jest.Mocked<
    Pick<BusinessConfigRepository, 'findByTenant'>
  >;
  let audit: jest.Mocked<Pick<AuditRecorder, 'record'>>;
  let logger: jest.Mocked<LoggerPort>;
  let useCase: SyncConversationLabelUseCase;

  beforeEach(() => {
    conversations = {
      findByClientPhone: jest.fn().mockResolvedValue(buildConversation(false)),
      pauseBot: jest.fn().mockResolvedValue(buildConversation(true)),
      resumeBot: jest.fn().mockResolvedValue(buildConversation(false)),
    };
    businessConfigs = {
      findByTenant: jest.fn().mockResolvedValue(buildConfig()),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    logger = { error: jest.fn(), warn: jest.fn() };
    useCase = new SyncConversationLabelUseCase(
      conversations as unknown as ConversationRepository,
      businessConfigs as unknown as BusinessConfigRepository,
      audit as unknown as AuditRecorder,
      logger,
    );
  });

  it('pauses the bot when the owner adds the human-attention label', async () => {
    await useCase.execute({
      chatJid: '59170000001@s.whatsapp.net',
      labelId: LABEL_ID,
      action: 'add',
    });

    expect(conversations.pauseBot).toHaveBeenCalledWith('cv1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CONVERSATION_BOT_PAUSED,
        after: { source: 'whatsapp_label' },
      }),
    );
  });

  it('resumes the bot when the owner removes the label', async () => {
    conversations.findByClientPhone.mockResolvedValue(buildConversation(true));

    await useCase.execute({
      chatJid: '59170000001@s.whatsapp.net',
      labelId: LABEL_ID,
      action: 'remove',
    });

    expect(conversations.resumeBot).toHaveBeenCalledWith('cv1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CONVERSATION_BOT_RESUMED,
        after: { source: 'whatsapp_label' },
      }),
    );
  });

  it('is idempotent: adding the label to an already paused chat does nothing', async () => {
    conversations.findByClientPhone.mockResolvedValue(buildConversation(true));

    await useCase.execute({
      chatJid: '59170000001@s.whatsapp.net',
      labelId: LABEL_ID,
      action: 'add',
    });

    expect(conversations.pauseBot).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('ignores a label that is not the managed one', async () => {
    await useCase.execute({
      chatJid: '59170000001@s.whatsapp.net',
      labelId: 'some-other-label',
      action: 'add',
    });

    expect(conversations.findByClientPhone).not.toHaveBeenCalled();
    expect(conversations.pauseBot).not.toHaveBeenCalled();
  });

  it('does nothing when label sync is disabled for the tenant', async () => {
    businessConfigs.findByTenant.mockResolvedValue(
      buildConfig({ humanAttentionLabelSync: false }),
    );

    await useCase.execute({
      chatJid: '59170000001@s.whatsapp.net',
      labelId: LABEL_ID,
      action: 'add',
    });

    expect(conversations.findByClientPhone).not.toHaveBeenCalled();
  });

  it('skips chats it cannot map to a phone (LID) instead of guessing', async () => {
    await useCase.execute({
      chatJid: '123456789@lid',
      labelId: LABEL_ID,
      action: 'add',
    });

    expect(conversations.findByClientPhone).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
