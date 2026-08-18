import {
  AgentTone,
  BusinessConfig,
  DEFAULT_AGENT_POLICY,
} from '@domain/business-config/entities/business-config.entity';
import { BusinessConfigRepository } from '@domain/business-config/repositories/business-config.repository';
import { LoggerPort } from '@domain/common/ports/logger.port';
import { Currency } from '@domain/common/value-objects/currency.vo';
import { ChatLabelPort } from '@domain/messaging/ports/chat-label.port';
import { EnsureHumanAttentionLabelUseCase } from './ensure-human-attention-label.use-case';

function buildConfig(
  overrides: {
    humanAttentionLabelSync?: boolean;
    evolutionInstanceName?: string | null;
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
    evolutionInstanceName:
      overrides.evolutionInstanceName === undefined
        ? 'nuvi-t1'
        : overrides.evolutionInstanceName,
    evolutionHumanLabelId: overrides.evolutionHumanLabelId ?? null,
  });
}

describe('EnsureHumanAttentionLabelUseCase', () => {
  let chatLabels: jest.Mocked<ChatLabelPort>;
  let businessConfigs: jest.Mocked<
    Pick<BusinessConfigRepository, 'findByTenant' | 'update'>
  >;
  let logger: jest.Mocked<LoggerPort>;
  let useCase: EnsureHumanAttentionLabelUseCase;

  beforeEach(() => {
    chatLabels = {
      ensureHumanAttentionLabel: jest
        .fn()
        .mockResolvedValue({ labelId: 'label-7', created: true }),
      addChatLabel: jest.fn(),
      removeChatLabel: jest.fn(),
    };
    businessConfigs = {
      findByTenant: jest.fn().mockResolvedValue(buildConfig()),
      update: jest.fn().mockResolvedValue(buildConfig()),
    };
    logger = { error: jest.fn(), warn: jest.fn() };
    useCase = new EnsureHumanAttentionLabelUseCase(
      chatLabels,
      businessConfigs as unknown as BusinessConfigRepository,
      logger,
    );
  });

  it('provisions the label and persists its id', async () => {
    await useCase.execute();

    expect(chatLabels.ensureHumanAttentionLabel).toHaveBeenCalledWith({
      tenantId: 't1',
      name: 'Requiere atención humana',
    });
    expect(businessConfigs.update).toHaveBeenCalledWith({
      evolutionHumanLabelId: 'label-7',
    });
  });

  it('does not rewrite the id when it already matches', async () => {
    businessConfigs.findByTenant.mockResolvedValue(
      buildConfig({ evolutionHumanLabelId: 'label-7' }),
    );

    await useCase.execute();

    expect(businessConfigs.update).not.toHaveBeenCalled();
  });

  it('does nothing when label sync is disabled', async () => {
    businessConfigs.findByTenant.mockResolvedValue(
      buildConfig({ humanAttentionLabelSync: false }),
    );

    await useCase.execute();

    expect(chatLabels.ensureHumanAttentionLabel).not.toHaveBeenCalled();
  });

  it('swallows provider failures so a connect never breaks', async () => {
    chatLabels.ensureHumanAttentionLabel.mockRejectedValue(
      new Error('cannot create label'),
    );

    await expect(useCase.execute()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
    expect(businessConfigs.update).not.toHaveBeenCalled();
  });
});
