import { Inject, Injectable } from '@nestjs/common';

import {
  BUSINESS_CONFIG_REPOSITORY,
  BusinessConfigRepository,
} from '@domain/business-config/repositories/business-config.repository';
import { ErrorCode, InternalError } from '@domain/common/exceptions';
import {
  ChatLabelPort,
  EnsureHumanAttentionLabelInput,
  HumanAttentionLabel,
  SetChatLabelInput,
} from '@domain/messaging/ports/chat-label.port';

import { EvolutionApiClient } from './evolution-api.client';

interface EvolutionEnsureLabelResponse {
  id: string;
  name: string;
  color?: number;
  created?: boolean;
}

// Purple in WhatsApp's predefined palette. Neutral choice; the color never drives
// behaviour, only what the owner sees next to the label.
const HUMAN_ATTENTION_LABEL_COLOR = 5;

@Injectable()
export class EvolutionChatLabelAdapter implements ChatLabelPort {
  constructor(
    private readonly client: EvolutionApiClient,
    @Inject(BUSINESS_CONFIG_REPOSITORY)
    private readonly businessConfigRepository: BusinessConfigRepository,
  ) {}

  async ensureHumanAttentionLabel(
    input: EnsureHumanAttentionLabelInput,
  ): Promise<HumanAttentionLabel> {
    const instanceName = await this.resolveInstanceName(input.tenantId);
    // ensureLabel is the Nuvi patch on Evolution 2.3.7 (docker/evolution/patches):
    // find-or-create by name, so repeated calls converge on a single label.
    const response = await this.client.post<EvolutionEnsureLabelResponse>(
      `/label/ensureLabel/${encodeURIComponent(instanceName)}`,
      { name: input.name, color: HUMAN_ATTENTION_LABEL_COLOR },
    );
    return { labelId: String(response.id), created: response.created === true };
  }

  async addChatLabel(input: SetChatLabelInput): Promise<void> {
    await this.handleLabel(input, 'add');
  }

  async removeChatLabel(input: SetChatLabelInput): Promise<void> {
    await this.handleLabel(input, 'remove');
  }

  private async handleLabel(
    input: SetChatLabelInput,
    action: 'add' | 'remove',
  ): Promise<void> {
    const instanceName = await this.resolveInstanceName(input.tenantId);
    await this.client.post(
      `/label/handleLabel/${encodeURIComponent(instanceName)}`,
      {
        number: this.toEvolutionNumber(input.toE164),
        labelId: input.labelId,
        action,
      },
    );
  }

  private async resolveInstanceName(tenantId: string): Promise<string> {
    const config = await this.businessConfigRepository.findByTenant();
    if (
      !config ||
      config.tenantId !== tenantId ||
      !config.evolutionInstanceName
    ) {
      throw new InternalError(ErrorCode.WHATSAPP_SESSION_NOT_CONNECTED);
    }
    return config.evolutionInstanceName;
  }

  private toEvolutionNumber(e164: string): string {
    return e164.replace(/\D/g, '');
  }
}
