import { Inject, Injectable } from '@nestjs/common';

import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { LOGGER_PORT, LoggerPort } from '@domain/common/ports/logger.port';
import {
  CHAT_LABEL_PORT,
  ChatLabelPort,
} from '@domain/messaging/ports/chat-label.port';

// Runs when an instance connects: find-or-create the human-attention label and
// remember its provider id, so the first handoff already has a label to apply.
// Best-effort — a business without the feature on, or a provider that will not
// create the label yet, simply carries on without one.
@Injectable()
export class EnsureHumanAttentionLabelUseCase {
  constructor(
    @Inject(CHAT_LABEL_PORT)
    private readonly chatLabels: ChatLabelPort,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigs: BusinessConfigRepository,
    @Inject(LOGGER_PORT)
    private readonly logger: LoggerPort,
  ) {}

  async execute(): Promise<void> {
    const config = await this.businessConfigs.findByTenant();
    if (!config?.agentPolicy.humanAttentionLabelSync) return;
    if (!config.evolutionInstanceName) return;

    try {
      const label = await this.chatLabels.ensureHumanAttentionLabel({
        tenantId: config.tenantId,
        name: config.agentPolicy.humanAttentionLabelName,
      });
      if (label.labelId !== config.evolutionHumanLabelId) {
        await this.businessConfigs.update({
          evolutionHumanLabelId: label.labelId,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Could not ensure the human-attention label for tenant ${config.tenantId}: ` +
          (error instanceof Error ? error.message : String(error)),
        EnsureHumanAttentionLabelUseCase.name,
      );
    }
  }
}
