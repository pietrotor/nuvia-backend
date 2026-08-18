import {
  AgentTone,
  BusinessConfig,
  DEFAULT_AGENT_POLICY,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { LoggerPort } from '@domain/common/ports/logger.port';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { Conversation } from '@domain/conversations/entities/conversation.entity';
import { ChatLabelPort } from '@domain/messaging/ports/chat-label.port';
import { ConversationHandoffLabelService } from './conversation-handoff-label.service';

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

const conversation = new Conversation({
  id: 'cv1',
  tenantId: 't1',
  clientId: 'c1',
  clientPhoneE164: '+59170000001',
  botPaused: true,
  botPausedAt: new Date(),
  handoffReason: 'client_request',
  lastActivityAt: new Date(),
});

describe('ConversationHandoffLabelService', () => {
  let chatLabels: jest.Mocked<ChatLabelPort>;
  let businessConfigs: jest.Mocked<
    Pick<BusinessConfigRepository, 'findByTenant'>
  >;
  let logger: jest.Mocked<LoggerPort>;
  let service: ConversationHandoffLabelService;

  beforeEach(() => {
    chatLabels = {
      ensureHumanAttentionLabel: jest.fn(),
      addChatLabel: jest.fn().mockResolvedValue(undefined),
      removeChatLabel: jest.fn().mockResolvedValue(undefined),
    };
    businessConfigs = {
      findByTenant: jest.fn().mockResolvedValue(buildConfig()),
    };
    logger = { error: jest.fn(), warn: jest.fn() };
    service = new ConversationHandoffLabelService(
      chatLabels,
      businessConfigs as unknown as BusinessConfigRepository,
      logger,
    );
  });

  it('adds the label to the chat when marking attention', async () => {
    await service.markAttention(conversation);

    expect(chatLabels.addChatLabel).toHaveBeenCalledWith({
      tenantId: 't1',
      labelId: LABEL_ID,
      toE164: '+59170000001',
    });
  });

  it('removes the label from the chat when clearing attention', async () => {
    await service.clearAttention(conversation);

    expect(chatLabels.removeChatLabel).toHaveBeenCalledWith({
      tenantId: 't1',
      labelId: LABEL_ID,
      toE164: '+59170000001',
    });
  });

  it('is a no-op when the tenant has label sync disabled', async () => {
    businessConfigs.findByTenant.mockResolvedValue(
      buildConfig({ humanAttentionLabelSync: false }),
    );

    await service.markAttention(conversation);

    expect(chatLabels.addChatLabel).not.toHaveBeenCalled();
  });

  it('warns and does nothing when the label id is not provisioned yet', async () => {
    businessConfigs.findByTenant.mockResolvedValue(
      buildConfig({ evolutionHumanLabelId: null }),
    );

    await service.markAttention(conversation);

    expect(chatLabels.addChatLabel).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('never throws when the provider fails: local state stays the source of truth', async () => {
    chatLabels.addChatLabel.mockRejectedValue(new Error('evolution down'));

    await expect(service.markAttention(conversation)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('ignores a null conversation (transition hit no row)', async () => {
    await service.markAttention(null);

    expect(businessConfigs.findByTenant).not.toHaveBeenCalled();
    expect(chatLabels.addChatLabel).not.toHaveBeenCalled();
  });
});
